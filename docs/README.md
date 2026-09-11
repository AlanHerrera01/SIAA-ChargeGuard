# Documentation — ChargeGuard

Directorio central de especificaciones técnicas, arquitectura, guías operativas y runbooks para **ChargeGuard**.

---

## 1. Especificaciones y Contratos (Source of Truth)
- [`contracts.md`](./contracts.md): Esquemas de datos, contratos de API (FastAPI, Mocks, DynamoDB, S3) y formatos JSON/REST para agentes, backend y frontend.
- [`human-in-the-loop.md`](./human-in-the-loop.md): Marco de seguridad y reglas de decisión que rigen la autonomía del agente y la intervención del usuario (Decision Card).

## 2. Arquitectura y Modelado
- [`architecture.excalidraw`](./architecture.excalidraw): Archivo editable en Excalidraw que detalla los componentes a 1080p (Amplify, API Gateway, Lambdas, Bedrock, DynamoDB, S3, EventBridge, CloudWatch y Mocks externos).
- [`architecture.png`](./architecture.png): Diagrama exportado a alta definición para documentación y README.

## 3. Guías para el Equipo
- [`guia-pruebas-equipo.md`](./guia-pruebas-equipo.md): Cómo probar el sistema desplegado antes de grabar el video, sin consumir el caso preparado.
- [`infraestructura-ismael.md`](./infraestructura-ismael.md): Mapa de la infraestructura en AWS, dónde ver cada recurso en la consola y las decisiones de arquitectura.

## 4. Guías Operativas y Despliegue
- [`deployment.md`](./deployment.md): Guía paso a paso de despliegue en AWS mediante Terraform, bootstrap remoto, empaquetado de Lambdas, seed y observabilidad.
- [`runbook.md`](./runbook.md): Procedimiento de respuesta rápida ante fallas en la demo en vivo, orden de fallbacks y diagnósticos.
- [`demo-script.md`](./demo-script.md): Guion cronometrado minuto a minuto para el video de presentación del hackathon (5 minutos).

## 5. Planificación y Ejecución
- [`execution-plan-infra.md`](./execution-plan-infra.md): Paquetes de trabajo de infraestructura, hitos de entrega y criterios de aceptación.
- [`prompts-executor.md`](./prompts-executor.md): Prompts estandarizados para ejecución de paquetes de trabajo.
