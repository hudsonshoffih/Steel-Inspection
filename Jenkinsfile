pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 90, unit: 'MINUTES')
  }

  parameters {
    booleanParam(
      name: 'FAIL_ON_CRITICAL',
      defaultValue: true,
      description: 'Fail when Trivy finds a fixable CRITICAL vulnerability.'
    )
    string(
      name: 'TRIVY_IMAGE',
      defaultValue: 'aquasec/trivy:0.58.1',
      description: 'Trivy container image used for image scanning.'
    )
  }

  triggers {
    pollSCM('H/5 * * * *')
  }

  environment {
    COMPOSE_PROJECT_NAME = "steel-inspection-ci-${BUILD_NUMBER}"
    WEB_PORT = '18080'
  }

  stages {
    stage('Checkout and validate') {
      steps {
        checkout scm
        script {
          env.IMAGE_TAG = sh(
            script: 'git rev-parse --short=7 HEAD',
            returnStdout: true
          ).trim()
        }
        sh '''
          set -eu
          for path in Jenkinsfile docker-compose.yml models/best.pt \
            ai_service/Dockerfile server/Dockerfile client/Dockerfile \
            scripts/smoke_test.sh ai_service/tests/test_services.py
          do
            test -f "$path" || {
              echo "Required file is missing: $path" >&2
              exit 1
            }
          done
          echo "Building images with tag ${IMAGE_TAG}"
        '''
      }
    }

    stage('Python tests') {
      steps {
        sh '/opt/ci-venv/bin/python -m pytest -q ai_service/tests'
      }
    }

    stage('Gateway type check') {
      steps {
        dir('server') {
          sh 'npm ci && npm run build'
        }
      }
    }

    stage('Frontend build') {
      steps {
        dir('client') {
          sh 'npm ci && npm run build'
        }
      }
    }

    stage('Docker build') {
      steps {
        sh '''
          set -eu
          docker build --file ai_service/Dockerfile \
            --tag "steel-ai:${IMAGE_TAG}" .
          docker build --file server/Dockerfile \
            --tag "steel-gateway:${IMAGE_TAG}" .
          docker build --file client/Dockerfile \
            --tag "steel-web:${IMAGE_TAG}" client
        '''
      }
    }

    stage('Trivy scan') {
      steps {
        script {
          def images = [
            'steel-ai',
            'steel-gateway',
            'steel-web'
          ]
          for (imageName in images) {
            def image = "${imageName}:${env.IMAGE_TAG}"
            echo "HIGH and CRITICAL findings for ${image}"
            withEnv(["TRIVY_IMAGE=${params.TRIVY_IMAGE}"]) {
              sh """
                docker run --rm \
                  -v /var/run/docker.sock:/var/run/docker.sock \
                  "\$TRIVY_IMAGE" image \
                  --scanners vuln \
                  --severity HIGH,CRITICAL \
                  --exit-code 0 \
                  '${image}'
              """
            }
          }
          if (params.FAIL_ON_CRITICAL) {
            for (imageName in images) {
              def image = "${imageName}:${env.IMAGE_TAG}"
              echo "Checking fixable CRITICAL findings for ${image}"
              withEnv(["TRIVY_IMAGE=${params.TRIVY_IMAGE}"]) {
                sh """
                  docker run --rm \
                    -v /var/run/docker.sock:/var/run/docker.sock \
                    "\$TRIVY_IMAGE" image \
                    --scanners vuln \
                    --severity CRITICAL \
                    --ignore-unfixed \
                    --exit-code 1 \
                    '${image}'
                """
              }
            }
          } else {
            echo 'FAIL_ON_CRITICAL is disabled; reports were still generated.'
          }
        }
      }
    }

    stage('Smoke test') {
      steps {
        sh '''
          set -eu
          TAG="${IMAGE_TAG}" WEB_PORT="${WEB_PORT}" docker compose up \
            --detach --no-build --wait --wait-timeout 360
          bash scripts/smoke_test.sh "http://host.docker.internal:${WEB_PORT}"
        '''
      }
    }
  }

  post {
    always {
      script {
        def cleanupStatus = sh(
          script: '''
            result=0
            mkdir -p artifacts || {
              echo "Failed to create artifacts directory." >&2
              result=1
            }
            TAG="${IMAGE_TAG:-local}" WEB_PORT="${WEB_PORT:-18080}" \
              docker compose logs --no-color > artifacts/docker-compose.log 2>&1
            if [ "$?" -ne 0 ]; then
              echo "Failed to save Docker Compose logs." >&2
              result=1
            fi
            TAG="${IMAGE_TAG:-local}" WEB_PORT="${WEB_PORT:-18080}" \
              docker compose down --remove-orphans
            if [ "$?" -ne 0 ]; then
              echo "Failed to tear down the smoke-test stack." >&2
              result=1
            fi
            exit "$result"
          ''',
          returnStatus: true
        )
        if (cleanupStatus != 0) {
          echo 'Smoke-test cleanup had errors; see the messages above.'
          currentBuild.result = 'FAILURE'
        }
      }
      archiveArtifacts artifacts: 'artifacts/**', allowEmptyArchive: true
    }
  }
}
