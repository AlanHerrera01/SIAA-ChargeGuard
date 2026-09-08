# ChargeGuard — Guion Oficial de Demostración (Video de 5 Minutos)

> **Duración total**: 5:00 minutos  
> **Track**: Everyday Agents — AWS Agents for Humans Hackathon 2026  
> **Participantes**: Alan Herrera (UX/Frontend), Ismael (Infra/DevOps), Stephani Rivera (Agentes), Andrea (Backend).  
> **Clímax del video**: **Minuto 3:15** — Presentación de la **Decision Card** (Human-in-the-Loop).

---

## Estructura del Video Minuto a Minuto

| Tiempo | Sección | En Pantalla (Visual) | Comando / Acción | Voz en Off (Guion Hablado) |
|---|---|---|---|---|
| **0:00 - 0:45** | **El Problema del Consumidor Cotidiano** | • Pantalla dividida: Notificaciones bancarias con incrementos silenciosos de suscripciones (Spotify, Netflix, SaaS).<br>• Estado de cuenta confuso y facturas PDF apiladas. | Abrir navegador en limpio con el dashboard de Amplify:<br>`https://main.d24otvpswldjmf.amplifyapp.com` | *"¿Alguna vez te diste cuenta de que tu suscripción mensual subió de precio dos meses después de que empezaron a cobrarte más? O peor: ¿te cobraron dos veces en el mismo ciclo y no tuviste tiempo de redactar un correo, buscar la factura y pelearlo? En promedio, un consumidor pierde entre $150 y $400 al año en cobros indebidos por falta de tiempo. Para solucionar esto creamos **ChargeGuard**: un agente de IA completamente autónomo que monitorea tus suscripciones, detecta anomalías, investiga las evidencias y negocia reembolsos por ti, despertándote solo cuando hay una decisión real que tomar."* |
| **0:45 - 1:30** | **Arquitectura en la Nube y Cero Costo Idle** | • Diagrama de arquitectura a 1080p ([`docs/architecture.png`](./architecture.png)).<br>• Terminal mostrando el stack de AWS Lambda y DynamoDB. | Mostrar en pantalla las tablas de DynamoDB y el endpoint de API Gateway:<br>`https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com` | *"ChargeGuard está construido sobre una arquitectura 100% serverless en AWS y el **Strands Agents SDK**. La aplicación web en **AWS Amplify** se comunica mediante **Amazon API Gateway** hacia un backend en **AWS Lambda** que orquesta cuatro sub-agentes especializados con **Amazon Bedrock** y Claude Sonnet 4.5. Toda la persistencia vive en tres tablas de **Amazon DynamoDB** On-Demand y un bucket **Amazon S3** con ciclo de vida de 30 días para facturas y correos. Si nadie usa el sistema, el costo de infraestructura es exactamente $0.00 dólares."* |
| **1:30 - 2:30** | **Detección de Anomalía e Investigación Autónoma** | • Navegar a la pestaña **Subscriptions** en la app.<br>• Mostrar la lista de servicios activos (`usr_demo`).<br>• Clic en **"Simular Incremento"** sobre Spotify ($10.99).<br>• O disparar desde terminal el webhook bancario real. | **Comando en vivo (opcional para terminal o clic en UI):**<br>`curl -X POST https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/mock/bank/transactions/notify -H "Content-Type: application/json" -d '{"transaction_id": "txn_0035"}'` | *"Veamos la magia en vivo. Aquí tenemos nuestras suscripciones monitoreadas. De pronto, el banco notifica una nueva transacción en Spotify: un cobro de $10.99 que ocurrió apenas 8 minutos después del cobro legítimo del mes. Instantáneamente, el orquestador activa a nuestro primer sub-agente: **ChargeAnalysisAgent**. Compara el cobro contra el historial y clasifica la anomalía como cobro duplicado con 98% de confianza. De inmediato, entra el **EvidenceAgent**: busca en Amazon S3 las facturas `inv_0034` e `inv_0035`, extrae las marcas de tiempo y valida que no hubo notificación previa de cobro extraordinario."* |
| **2:30 - 3:15** | **Redacción y Envío Autónomo de la Disputa** | • Vista del **Timeline del Caso** en tiempo real.<br>• Logs estructurados en CloudWatch o en la UI mostrando los eventos `anomaly_detected` $\rightarrow$ `evidence_gathered` $\rightarrow$ `dispute_filed`. | Navegar a la vista de detalle de la disputa en el frontend:<br>`/disputes/{case_id}` | *"Con las pruebas en mano, el sub-agente **DisputeAgent** redacta una carta formal citando los números de factura, fechas exactas y solicitando el reembolso de $10.99. ChargeGuard envía el reclamo directamente a la API de soporte del comercio. El comercio procesa el caso y devuelve una respuesta: 'Podemos ofrecerte un crédito de cortesía inmediato de $6.59'."* |
| **3:15 - 4:15** | **EL CLÍMAX: La Decision Card (Human-in-the-Loop)** | • **PANTALLA PRINCIPAL**: El Dashboard muestra la tarjeta con borde ámbar brillante y la insignia **"Acción Requerida"**.<br>• Se despliega la **Decision Card** destacando:<br>  - Oferta del comercio: **$6.59 USD**<br>  - Reclamo original: **$10.99 USD**<br>  - Recomendación del agente: *"Aceptar para resolver de inmediato sin arbitraje formal"*.<br>• El cursor se posa sobre los dos botones de acción. | Mostrar la **Decision Card** en grande.<br><br>Hacer clic deliberado en el botón verde:<br>**[Aceptar Oferta ($6.59)]** | *"Y aquí está el núcleo de lo que nos diferencia: **Human-in-the-Loop**. El sub-agente **NegotiationAgent** evaluó la contraoferta y vio que cubre el 60% del reclamo de forma inmediata. Pero por regla de seguridad estricta, **el agente jamás toma decisiones de dinero a espaldas del usuario**. El sistema pausa toda ejecución autónoma y genera esta **Decision Card**. Aquí el usuario tiene la última palabra: puede rechazar y escalar a una disputa bancaria formal, o aceptar los $6.59 en un solo clic. Hacemos clic en 'Aceptar Oferta'..."* |
| **4:15 - 4:45** | **Resolución, Reembolso y Actualización de Métricas** | • Animación de éxito.<br>• El timeline cambia a `resolved_accepted` con fecha de reembolso (5 días).<br>• Las métricas del Dashboard se actualizan:<br>  - Recuperado: **$49.09 USD**<br>  - Disputas resueltas: **100%** | Mostrar el Dashboard refrescado con la nueva cifra y el CloudWatch Dashboard en otra pestaña. | *"En milisegundos, el backend confirma el acuerdo con el comercio, persiste el cierre en DynamoDB y actualiza nuestras métricas en vivo: hemos recuperado $6.59 adicionales sin haber redactado una sola línea de reclamo. Todo el proceso quedó auditado en Amazon CloudWatch con trazabilidad inmutable de cada paso."* |
| **4:45 - 5:00** | **Cierre y Llamado a la Acción** | • Cámara al equipo o pantalla de cierre con enlaces al repositorio de GitHub y credenciales de demo para los jueces. | Mostrar URL del repo:<br>`https://github.com/AlanHerrera01/SIAA-ChargeGuard` | *"ChargeGuard devuelve el control y el dinero a las personas en un mundo saturado de suscripciones invisibles. Construido para el AWS Agents for Humans Hackathon 2026. Muchas gracias."* |

---

## Comandos Clave Preparados para la Grabación

### 1. Resetear el Estado antes de Grabar (Ambiente Limpio)
```bash
# Limpia las disputas de prueba y reinicia los contadores de mock
python scripts/demo_reset.py
```

### 2. Disparar Transacción Anómala por Terminal (Fallback al botón de la UI)
```bash
curl -X POST https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/mock/bank/transactions/notify \
  -H "Content-Type: application/json" \
  -d '{"transaction_id": "txn_0035"}'
```

### 3. Consultar Estado en Vivo del Caso
```bash
curl -s https://6zx34nx8v7.execute-api.us-east-1.amazonaws.com/cases | jq .
```
