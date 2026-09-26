# Infrastructure

Terraform for the static site: private **S3** bucket + **CloudFront** (Origin Access Control) + a **GitHub Actions OIDC** deploy role. No servers.

## Architecture

```mermaid
flowchart LR
    user([Visitor]):::ext

    subgraph aws["AWS"]
        cf["CloudFront distribution<br/>redirect-to-https · gzip<br/>403/404 → /404.html"]
        oac{{"Origin Access Control<br/>(SigV4 signed)"}}
        s3[("S3 bucket (private)<br/>static build<br/>public access blocked")]
        role["IAM role: gha-deploy<br/>s3 Put/Delete/List +<br/>cloudfront CreateInvalidation"]
        tfrole["IAM role: gha-terraform<br/>s3/cloudfront/iam"]
        oidc{{"IAM OIDC provider<br/>token.actions.githubusercontent.com"}}
    end

    subgraph gh["GitHub"]
        push["push to main"] --> actions["Actions: ci-cd.yml<br/>lint → test → build → deploy"]
        infrapush["push to main<br/>(infra/**)"] --> tfapply["Actions: terraform.yml apply job<br/>terraform apply"]
        pr["PR touching infra/**"] --> tfplan["Actions: terraform.yml plan job<br/>terraform plan → PR comment"]
    end

    tfstate[("S3 backend bucket<br/>terraform.tfstate<br/>native lockfile")]:::ext

    %% request path
    user -->|HTTPS| cf
    cf --> oac -->|"s3:GetObject<br/>(bucket policy: SourceArn = this dist)"| s3

    %% app deploy path
    actions -->|AssumeRoleWithWebIdentity<br/>sub=repo:…:ref:refs/heads/main| oidc
    oidc -.->|federates| role
    actions -->|"aws s3 sync"| s3
    actions -->|"create invalidation"| cf

    %% infra deploy path
    tfapply -->|AssumeRoleWithWebIdentity<br/>sub=repo:…:ref:refs/heads/main| oidc
    tfplan -->|AssumeRoleWithWebIdentity<br/>sub=repo:…:pull_request| oidc
    oidc -.->|federates| tfrole
    tfapply -->|provisions| aws
    tfapply -->|state| tfstate
    tfplan -->|state (read)| tfstate

    classDef ext fill:#f2f0ea,stroke:#c8102e,color:#141414;
```

**Request path:** visitor → CloudFront (HTTPS) → OAC-signed read from the private S3 bucket. The bucket denies all public access; its policy only allows `cloudfront.amazonaws.com` scoped to this distribution's ARN.

**Deploy path:** push to `main` → GitHub Actions builds, then assumes `gha-deploy` via GitHub OIDC (no stored AWS keys) → `s3 sync` the build and issue a CloudFront invalidation.

## Prerequisites

- Terraform >= 1.5
- AWS credentials with admin-ish rights for the initial apply (`aws configure` or `AWS_PROFILE`)

## First apply

Terraform state lives in an S3 backend (`backend.tf`) with native S3 locking — no DynamoDB
table needed. That bucket can't be created by the same Terraform config that needs it to
store its own state, so create it manually first:

```bash
aws s3 mb s3://portfolio-tfstate-777799876926 --region eu-west-2
aws s3api put-bucket-versioning --bucket portfolio-tfstate-777799876926 --versioning-configuration Status=Enabled
```

That name is already committed in `infra/backend.tf`'s `bucket` and as the `tfstate_bucket`
default in `infra/variables.tf`. `backend.tf` can't reference variables, so if you point this
stack at a different bucket you must change both by hand or the terraform role's state
permissions won't match the bucket the backend actually writes to.

```bash
cd infra
terraform init
terraform apply
```

## Wire up CI deploy

`terraform apply` prints the outputs below. Set them as **GitHub repository variables**
(Settings → Secrets and variables → Actions → *Variables*), or:

```bash
gh variable set S3_BUCKET                 -b "$(terraform output -raw bucket_name)"
gh variable set CLOUDFRONT_DISTRIBUTION_ID -b "$(terraform output -raw distribution_id)"
gh variable set AWS_DEPLOY_ROLE_ARN       -b "$(terraform output -raw deploy_role_arn)"
gh variable set AWS_REGION                -b "$(terraform output -raw aws_region)"
gh variable set SITE_URL                  -b "https://your-domain.example"
```

Also set **`SITE_URL`**, to your real domain (or `terraform output -raw cloudfront_url` if you
haven't attached a custom domain yet). It's read at build time for every canonical URL,
OG tag, sitemap entry and RSS link — leaving it unset silently ships
`http://localhost:4321` everywhere.

After that, every push to `main` builds and deploys via `.github/workflows/ci-cd.yml`
(no long-lived AWS keys — the workflow assumes the role through OIDC).

Live URL: `terraform output -raw cloudfront_url`.

## Wire up CI-driven terraform apply

`terraform apply` also prints `terraform_role_arn`. Set it as a **GitHub repository
variable**:

```bash
gh variable set AWS_TERRAFORM_ROLE_ARN -b "$(terraform output -raw terraform_role_arn)"
```

After that, `.github/workflows/terraform.yml` handles `infra/` changes: a PR touching
that path gets a `terraform plan` posted as a PR comment; a merge to `main` runs
`terraform apply` automatically (same OIDC trust model as the app deploy, no stored AWS
keys). The `gha-terraform` role itself has to exist before CI can assume it — bootstrap
it with one local `terraform apply` first, same as `gha-deploy`.

There's no branch-protection gate on the `plan` check (GitHub Pro is required for
required-status-checks on a private repo) — treat a red `plan` job as "don't merge yet",
not as something that physically blocks the merge button.

## Shared OIDC provider

AWS permits exactly one IAM OIDC provider per issuer URL per account, and this account's
`token.actions.githubusercontent.com` provider already exists — `taisei-karate` created it.
So `oidc.tf` does not create one by default: `var.existing_oidc_provider_arn` defaults to
that ARN and both roles' trust policies point at it. Creating a second provider for the
same URL fails with `EntityAlreadyExists`; it is not a per-project resource.

Set the variable to `""` only when applying into an account that has no GitHub Actions
provider yet — Terraform then creates and manages one itself. Leave it alone in this
account: destroying that provider is account-wide and would break every other repo that
federates in, `taisei-karate` included.

## Notes

- Bucket is private; only CloudFront can read it (OAC + bucket policy scoped to the distribution ARN).
- Bucket versioning is enabled for rollback after a bad deploy; noncurrent versions expire after 30 days.
- Responses carry a security headers policy (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-XSS-Protection).
- Routing: a missing/mistyped path is a real 404 — CloudFront maps 403/404 → `/404.html` (response code 404), not to the homepage.
- Caching: content-hashed `_astro/*` uploaded `immutable`; `images/*` (committed by hand at stable paths) uploaded with a 1-hour cache; every page, `sitemap*.xml`, `rss.xml` and `robots.txt` uploaded `no-cache` — set by the deploy job in `.github/workflows/ci-cd.yml`. `public/images/` is empty today, so the deploy job skips that sync until the directory exists.
- Monitoring (`monitoring.tf`, on by default via `var.enable_monitoring`): one SNS topic and two CloudFront alarms — 5xx rate above 1% for 10 minutes, and more than 50k requests in 5 minutes. The topic lives in us-east-1 because CloudFront publishes metrics only there and an alarm can only notify a topic in its own region; a regional (eu-west-2) topic would have nothing to publish to it. The first apply sends one subscription-confirmation email to `var.alert_email` — until it is clicked the topic delivers nothing.
- There is deliberately no CloudTrail trail and no flag for one: `taisei-karate`'s trail is account-wide and already captures this account's management events, and AWS bills only one free copy of those per account. Adding an independent trail here means real HCL (trail + log bucket + bucket policy), not a variable.
