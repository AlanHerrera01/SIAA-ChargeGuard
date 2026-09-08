# Human-in-the-Loop (HITL) — Decision Framework & Safety Rules

> **Filosofía de ChargeGuard**: *Sleep through the price hike. Wake up to a refund.*  
> El sistema actúa con autonomía completa para el trabajo repetitivo y de investigación, pero **siempre cede el control final al usuario cuando existen acuerdos comerciales, concesiones económicas o ambigüedad**.

---

## 1. Matriz de Autonomía vs. Intervención Humana

| Fase del Ciclo de Vida | Rol del Agente | ¿Requiere Usuario? | Motivo de Diseño |
|---|---|:---:|---|
| **Detección de Anomalías** | Autónomo | ❌ No | Ingesta transaccional en tiempo real. Análisis estadístico y comparativa contra contratos previos (`charge_analysis`). |
| **Recolección de Evidencias** | Autónomo | ❌ No | Descarga de facturas en S3, análisis de correos RFC822 y lectura de cláusulas de términos y condiciones (`evidence_investigation`). |
| **Presentación del Reclamo Inicial** | Autónomo | ❌ No | Si la anomalía está fundamentada documentalmente, el reclamo se presenta automáticamente al canal de disputas del comercio (`dispute_drafting`). |
| **Reembolso Total Aceptado por Comercio** | Autónomo | ❌ No | Si el comercio responde `resolved_full` aprobando el 100% del monto reclamado, el caso se cierra con éxito y se notifican las métricas en el dashboard. |
| **Contraoferta Parcial del Comercio** | **Pausa y Recomendación** | ✅ **SÍ (BLOQUEANTE)** | El comercio ofrece un crédito o reembolso parcial (ej. $6.59 sobre $10.99 reclamados). **El agente tiene estrictamente prohibido aceptar acuerdos económicos a espaldas del usuario**. |
| **Rechazo o Negativa del Comercio** | **Pausa y Recomendación** | ✅ **SÍ (BLOQUEANTE)** | Si el reclamo es denegado o requiere escalación formal, el usuario decide si archivar o elevar a arbitraje con su entidad bancaria. |
| **Confianza Baja (< 0.70) o Ambigüedad** | **Alerta Preventiva** | ✅ **SÍ (BLOQUEANTE)** | Si el LLM no puede certificar si el cobro es anómalo, no emite reclamos temerarios: solicita confirmación al usuario. |

---

## 2. El Momento Clímax: La "Decision Card"

Cuando el mock del comercio o la API real emite una contraoferta (`counter_offer`), se dispara la salvaguarda de seguridad:

1. **Evaluación no vinculante (`counter_offer_evaluation`)**:
   El agente `negotiation_agent` analiza la oferta contra la evidencia documental:
   - Si la oferta cubre una porción justa sin mayor mérito documental en disputa $\rightarrow$ recomienda `accept_offer`.
   - Si la evidencia demuestra mala fe o cobro indebido total flagrante $\rightarrow$ recomienda `reject_and_request_full_refund`.
2. **Congelación del Estado en DynamoDB**:
   El orquestador transiciona el caso a:
   ```json
   {
     "status": "awaiting_human",
     "decision": {
       "required": true,
       "recommendation": "accept_offer",
       "reason": "El comercio ofrece $6.59 como crédito de cortesía inmediato."
     }
   }
   ```
3. **Presentación en la Interfaz (Frontend)**:
   - El Dashboard enciende la insignia parpadeante en ámbar **"Acción Requerida"**.
   - Se renderiza la **Decision Card** destacando:
     - Monto original disputado vs. Monto ofrecido.
     - Razonamiento explicativo del sub-agente.
     - Dos acciones explícitas: **[Aceptar Oferta]** o **[Rechazar y Solicitar Reembolso Completo]**.
4. **Resolución Humana**:
   El usuario hace clic en su preferencia, disparando `POST /decisions/{case_id}/resolve`:
   - El backend ejecuta la instrucción exacta elegida por el usuario.
   - El comercio recibe la aceptación o escalación.
   - DynamoDB y CloudWatch registran el evento con actor `user`.

---

## 3. Salvaguardas Determinísticas de Integridad Financiera

Para garantizar que el LLM nunca incurra en alucinaciones destructivas:
- **Cero Mutaciones de Montos**: Los importes reclamados son calculados matemáticamente por código determinístico (`actual_amount - expected_amount`). El LLM no puede alterar los números en los payloads enviados a las APIs.
- **Trazabilidad Inmutable**: Cada cambio de estado genera una entrada en el array `timeline` con marca de tiempo UTC (`at`), identificador del actor (`chargeguard`, `merchant_api`, `user`) y detalle descriptivo.
- **Idempotencia de Comandos**: Las llamadas a `/decisions/{case_id}/resolve` sobre un caso ya resuelto devuelven idempotentemente el estado actual sin duplicar reembolsos ni peticiones al comercio.
