# Strands Multi-Agent Tools & Architecture

Este directorio documenta el modelo de herramientas y delegación multi-agente de **ChargeGuard**, construido sobre el **Strands Agents SDK** (`strands.Agent`) y modelos fundacionales de **Amazon Bedrock** (Claude Sonnet 4.5).

---

## 1. Patrón de Delegación: `as_tool()` sobre Agentes Especializados

En lugar de definir herramientas aisladas mediante decoradores genéricos `@tool`, ChargeGuard implementa el patrón de **orquestación jerárquica** de Strands: cada sub-agente especializado es una instancia de `strands.Agent` que expone sus capacidades como una herramienta (`as_tool()`) al orquestador principal.

Este diseño desacopla las responsabilidades de razonamiento, mantiene prompts de sistema hiperenfocados y reduce el consumo de tokens en Bedrock.

```
                  ┌─────────────────────────────────────┐
                  │   chargeguard_orchestrator_agent    │
                  │       (strands.Agent - Bedrock)     │
                  └──────────────────┬──────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │ as_tool()               │ as_tool()               │ as_tool()               │ as_tool()
           ▼                         ▼                         ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│    charge_analysis   │  │evidence_investigation│  │   dispute_drafting   │  │counter_offer_eval... │
│ (ChargeAnalysisAgent)│  │   (EvidenceAgent)    │  │    (DisputeAgent)    │  │  (NegotiationAgent)  │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

---

## 2. Especialistas Registrados en el Orquestador

Definidos en [`agents/strands_orchestrator.py`](../agents/strands_orchestrator.py):

| Herramienta Delegada (`as_tool`) | Módulo Fuente | Responsabilidad | Modelo Bedrock |
|---|---|---|---|
| **`charge_analysis`** | [`agents/charge_analysis.py`](../agents/charge_analysis.py) | Evalúa transacciones recurrentes para detectar discrepancias con respecto a contratos o cobros duplicados. Calcula la confianza y clasifica la anomalía. | Claude Sonnet 4.5 |
| **`evidence_investigation`** | [`agents/evidence.py`](../agents/evidence.py) | Extrae y sintetiza evidencia de facturas PDF (en S3), correos electrónicos RFC822 y términos contractuales para fundamentar el reclamo. | Claude Sonnet 4.5 |
| **`dispute_drafting`** | [`agents/dispute.py`](../agents/dispute.py) | Redacta formalmente la carta de disputa dirigida al canal de soporte del comercio con montos exactos y referencias a la evidencia documental. | Claude Sonnet 4.5 |
| **`counter_offer_evaluation`** | [`agents/negotiation.py`](../agents/negotiation.py) | Evalúa las contraofertas monetarias o créditos devueltos por el comercio. **Nunca acepta o rechaza autónomamente**: genera la recomendación para la Decision Card del usuario. | Claude Sonnet 4.5 |

---

## 3. Principio de Salvaguarda Determinística (Human-in-the-Loop)

Para garantizar integridad financiera y evitar alucinaciones en cobros reales:

1. **Valores críticos inviolables**: El orquestador determinístico (`agents/orchestrator.py`) valida de forma estricta los IDs de transacción, montos reclamados y estado de DynamoDB antes y después de cada invocación de LLM.
2. **Sin decisiones unilaterales**: `counter_offer_evaluation` tiene prohibido aceptar o rechazar acuerdos comerciales; su función es estructurar la decisión para el usuario en la interfaz web.
3. **Manejo de estados en DynamoDB**: Cada transición del caso (`anomaly_detected` → `evidence_gathered` → `dispute_filed` → `awaiting_human` → `resolved`) se persiste de forma transaccional e idempotente.
