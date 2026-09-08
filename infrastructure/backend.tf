# backend.tf
#
# Configuración del backend remoto en Amazon S3 con bloqueo concurrente mediante DynamoDB.
#
# Orden de ejecución (según infrastructure/README.md y WP-06/WP-08):
# 1. En WP-06 (etapa actual), la infraestructura se planifica y valida sin ejecutar 'apply',
#    manteniendo el estado local para no forzar la creación anticipada de recursos en AWS.
# 2. Una vez que el equipo revise y aplique el bootstrap en WP-08:
#      cd infrastructure/bootstrap && terraform apply
#      cd ..
#    Copie backend.hcl.example a backend.hcl (con el Account ID real), descomente el bloque
#    s3 a continuación y ejecute:
#      terraform init -backend-config=backend.hcl -migrate-state

terraform {
  backend "s3" {}
}

