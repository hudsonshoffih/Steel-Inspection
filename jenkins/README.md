# Jenkins CI

This Jenkins setup runs the repository's Python tests, gateway TypeScript
build, frontend build, Docker image builds, Trivy scans, and full-stack smoke
test. It builds images named `steel-ai`, `steel-gateway`, and `steel-web`,
tagged with the checked-out commit's short SHA.

## Start Jenkins

From the repository root, stop the local application stack if it is running,
then start Jenkins:

```sh
docker compose down
cd jenkins
docker compose up -d --build
docker compose exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open <http://localhost:8081>, install the suggested plugins, and create the
initial admin user. Confirm the Jenkins image has the required tools:

```sh
docker compose exec jenkins bash -c \
  "docker version --format '{{.Client.Version}}'; docker compose version; node -v; python3 --version"
```

## Configure the job

Create a **Pipeline** job using **Pipeline script from SCM**. Set the SCM to
this repository, select branch `*/main`, and set the script path to
`Jenkinsfile`. For a private repository, configure a Jenkins credential with
the GitHub username and token; do not put credentials in the Jenkinsfile.

Choose **Build with Parameters** to run. `FAIL_ON_CRITICAL` defaults to true;
turning it off skips only the failure gate, not the Trivy reports. Trivy
reports HIGH and CRITICAL findings and fails the build only for fixable
CRITICAL findings. `TRIVY_IMAGE` defaults to `aquasec/trivy:0.58.1`.

The smoke test publishes the web image on port 18080 and reaches it from the
Jenkins container through `host.docker.internal`. The Compose project is
isolated by build number, its logs are archived, and the stack is torn down
after each run. Jenkins polls SCM every five minutes.

Docker socket access gives Jenkins control of the Docker daemon and its
containers; use this configuration only in a trusted local CI environment.
