#!/usr/bin/env bash
# install_telegraf_k8s.sh
# Kubernetes-friendly script to apply Telegraf ConfigMap, SealedSecret (if present), and DaemonSet.
# This script assumes kubectl is configured and (optionally) kubeseal is available to create SealedSecret.

set -euo pipefail
SCRIPTDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOTDIR="$(cd "${SCRIPTDIR}/.." && pwd)"
SEALED_DIR="$ROOTDIR/k8s/sealed"
TELEGRAF_DIR="$ROOTDIR/k8s/telegraf"
NAMESPACE="ibuki-mitarashi-bot"

usage() {
  cat <<EOF
Usage: $0 [--apply-sealed | --seal-raw] [--kubeseal-cert path/to/cert.pem]

Options:
  --apply-sealed        Apply existing sealed secret (env.yaml) and telegraf k8s manifests
  --seal-raw            Seal raw_env.yaml -> env.yaml using kubeseal (requires kubeseal and cert)
  --kubeseal-cert PATH  Path to the public cert to use with kubeseal (defaults to k8s/sealed/cert.pem)
  --namespace NAMESPACE Kubernetes namespace to apply resources (default: $NAMESPACE)
  -h, --help            Show this help

This script is intended for Linux/macOS shells used to manage Kubernetes resources.
EOF
}

# Defaults
APPLY_SEALED=false
SEAL_RAW=false
KUBESEAL_CERT="$SEALED_DIR/cert.pem"

while [[ $# -gt 0 ]]; do
  case $1 in
    --apply-sealed) APPLY_SEALED=true; shift ;;
    --seal-raw) SEAL_RAW=true; shift ;;
    --kubeseal-cert) KUBESEAL_CERT="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

# 1) Optionally seal raw_env.yaml
if [ "$SEAL_RAW" = true ]; then
  if ! command -v kubeseal >/dev/null 2>&1; then
    echo "kubeseal not found in PATH. Install kubeseal before running with --seal-raw."
    exit 1
  fi
  RAW="$SEALED_DIR/raw_env.yaml"
  OUT="$SEALED_DIR/env.yaml"
  if [ ! -f "$RAW" ]; then
    echo "raw_env.yaml not found at $RAW"
    exit 1
  fi
  echo "Sealing $RAW -> $OUT using cert $KUBESEAL_CERT"
  kubeseal --format=yaml --cert="$KUBESEAL_CERT" < "$RAW" > "$OUT"
  echo "Wrote $OUT"
fi

# 2) Apply SealedSecret (env.yaml) if requested
if [ "$APPLY_SEALED" = true ]; then
  SEALED="$SEALED_DIR/env.yaml"
  if [ ! -f "$SEALED" ]; then
    echo "Sealed secret $SEALED not found. If you need to create it from raw, run with --seal-raw"
    exit 1
  fi
  echo "Applying $SEALED"
  kubectl apply -f "$SEALED"
fi

# 3) Apply Telegraf ConfigMap and DaemonSet
echo "Applying Telegraf ConfigMap and DaemonSet in namespace $NAMESPACE"
kubectl apply -f "$TELEGRAF_DIR/telegraf-configmap.yaml"
kubectl apply -f "$TELEGRAF_DIR/telegraf-daemonset.yaml"

echo "Done. Check DaemonSet rollout and Pod status:"
cat <<EOF
kubectl -n $NAMESPACE rollout status daemonset/telegraf
kubectl -n $NAMESPACE get pods -l app=telegraf -o wide
kubectl -n $NAMESPACE describe pod <one-of-pod-names>
EOF

exit 0
