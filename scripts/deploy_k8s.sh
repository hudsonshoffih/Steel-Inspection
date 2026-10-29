#!/usr/bin/env bash
# Copies the Kubernetes files to the server and applies them with k3s.
# Usage: scripts/deploy_k8s.sh <dockerhub-user> <tag> <server-ip>
# The Kubernetes API port (6443) stays closed to the internet: we go through SSH instead.
set -euo pipefail
HUB_USER="${1:?usage: $0 <dockerhub-user> <tag> <server-ip>}"
TAG="${2:?missing tag}"
IP="${3:?missing server ip}"
KEY="${SSH_KEY:-$HOME/.ssh/steel-key.pem}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new ubuntu@$IP"
cd "$(dirname "$0")/.."

$SSH "rm -rf ~/k8s && mkdir -p ~/k8s"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new deploy/k8s/*.yaml "ubuntu@$IP:~/k8s/"
$SSH "cd ~/k8s && sed -i 's#DOCKERHUB_USER#$HUB_USER#g; s#IMAGE_TAG#$TAG#g' kustomization.yaml \
  && k3s kubectl apply -k . \
  && k3s kubectl -n steel rollout status deployment/ai --timeout=600s \
  && k3s kubectl -n steel rollout status deployment/gateway --timeout=120s \
  && k3s kubectl -n steel rollout status deployment/web --timeout=120s \
  && k3s kubectl -n steel get pods"
echo "Open http://$IP/"
