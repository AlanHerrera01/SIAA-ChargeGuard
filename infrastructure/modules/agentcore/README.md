# AgentCore Runtime Module

## Estado y soporte en Terraform AWS Provider

A la fecha (septiembre 2026), el runtime **Amazon Bedrock AgentCore Runtime** se encuentra en fase de adopción reciente / preview por AWS, y el provider oficial de Terraform (`hashicorp/aws`) aún no expone recursos nativos específicos bajo la nomenclatura `aws_bedrock_agentcore_runtime`.

## Decisión de Arquitectura y Estrategia de Fallback

Conforme a las reglas de `docs/execution-plan-infra.md §5` y `docs/prompts-executor.md §6`:
1. **No bloqueante**: Este módulo documenta el estado y define la infraestructura preparatoria (Log Group dedicado `/aws/bedrock/agentcore/chargeguard` con retención de 7 días).
2. **Fallback oficial acordado por el equipo**: El agente autónomo (Strands Agents SDK en Python) se empaqueta y ejecuta dentro de AWS Lambda (o contenedor serverless).
3. **Mínimo privilegio**: El rol de ejecución `chargeguard-agentcore-role` y el rol `chargeguard-lambda-exec-role` creados en `modules/iam/` ya cuentan con los permisos estrictamente acotados para invocar el inference profile de Claude Sonnet 4.5 (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`), consultar las 3 tablas DynamoDB y leer/escribir en el bucket de evidencia S3.
4. Si el provider incorpora soporte nativo para AgentCore en releases posteriores, los recursos se acoplarán directamente referenciando el rol `agentcore_role_arn`.
