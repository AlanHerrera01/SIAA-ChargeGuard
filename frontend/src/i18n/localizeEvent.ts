import type { Language } from "./translations";

/**
 * Translates agent-generated English texts (anomaly analyses, evidence summaries,
 * dispute letters, merchant offers, dates, and negotiation recommendations) into natural Spanish
 * when language === "es", while keeping dynamic values (amounts, dates, IDs, merchant names) intact.
 */
export function localizeText(text: string | null | undefined, language: Language): string {
  if (!text) return "";
  if (language === "en") return text;

  let translated = text;

  // 0. English Month and Date Localization
  translated = translated.replace(/\bJanuary (\d{1,2}), (\d{4})\b/g, "$1 de enero de $2");
  translated = translated.replace(/\bFebruary (\d{1,2}), (\d{4})\b/g, "$1 de febrero de $2");
  translated = translated.replace(/\bMarch (\d{1,2}), (\d{4})\b/g, "$1 de marzo de $2");
  translated = translated.replace(/\bApril (\d{1,2}), (\d{4})\b/g, "$1 de abril de $2");
  translated = translated.replace(/\bMay (\d{1,2}), (\d{4})\b/g, "$1 de mayo de $2");
  translated = translated.replace(/\bJune (\d{1,2}), (\d{4})\b/g, "$1 de junio de $2");
  translated = translated.replace(/\bJuly (\d{1,2}), (\d{4})\b/g, "$1 de julio de $2");
  translated = translated.replace(/\bAugust (\d{1,2}), (\d{4})\b/g, "$1 de agosto de $2");
  translated = translated.replace(/\bSeptember (\d{1,2}), (\d{4})\b/g, "$1 de septiembre de $2");
  translated = translated.replace(/\bOctober (\d{1,2}), (\d{4})\b/g, "$1 de octubre de $2");
  translated = translated.replace(/\bNovember (\d{1,2}), (\d{4})\b/g, "$1 de noviembre de $2");
  translated = translated.replace(/\bDecember (\d{1,2}), (\d{4})\b/g, "$1 de diciembre de $2");

  // 1. Salutations and Dispute Letter Opening
  translated = translated.replace(
    /Dear ([^,:\n]+)[,:]/gi,
    "Estimado equipo de $1:"
  );

  translated = translated.replace(
    /I am writing to dispute a charge that was posted to my account after my subscription cancellation\.?/gi,
    "Escribo para disputar un cargo registrado en mi cuenta con posterioridad a la cancelación de mi suscripción."
  );

  translated = translated.replace(
    /My subscription \(([^)]+)\) was cancelled on ([^,]+),\s*as confirmed by cancellation documentation\.?/gi,
    "Mi suscripción ($1) fue cancelada el $2, según consta en la documentación de confirmación."
  );

  translated = translated.replace(
    /However, a charge of \$([\d,.]+) USD was posted to my account on ([^—\n]+)—(\d+) days after the cancellation date\.?/gi,
    "Sin embargo, se realizó un cobro de $$$1 USD el $2 ($3 días después de la fecha de cancelación)."
  );

  translated = translated.replace(
    /No charges should occur following a subscription cancellation\.?/gi,
    "No debe efectuarse ningún cobro tras haber cancelado la suscripción."
  );

  translated = translated.replace(
    /No charge should have occurred after cancellation\.?/gi,
    "Ningún cobro debió ocurrir tras la cancelación."
  );

  // 2. Price Hike Dispute Letter Sentences
  translated = translated.replace(
    /I am writing to dispute transaction ([a-z0-9_]+) for \$([\d,.]+) USD due to an unjustified price increase on my subscription\.?/gi,
    "Escribo para disputar la transacción $1 por $$$2 USD debido a un incremento de precio no justificado en mi suscripción."
  );

  translated = translated.replace(
    /For (\d+) consecutive months from ([^,]+),\s*my ([A-Za-z0-9\s]+) subscription charge remained consistent at \$([\d,.]+) USD\.?/gi,
    "Durante $1 meses consecutivos ($2), el cobro de mi suscripción a $3 se mantuvo consistente en $$$4 USD."
  );

  translated = translated.replace(
    /However, the current charge has increased to \$([\d,.]+) USD,\s*representing a \$([\d,.]+) increase or (\d+)% above my established billing history\.?/gi,
    "Sin embargo, el cobro actual aumentó a $$$1 USD, lo que representa un incremento de $$$2 USD ($3% por encima de mi historial de facturación)."
  );

  translated = translated.replace(
    /I have not received any notification of a plan change or pricing adjustment that would justify this increase\.?/gi,
    "No he recibido notificación alguna de cambio de plan o ajuste tarifario que justifique este incremento."
  );

  translated = translated.replace(
    /My subscription terms and previous invoices confirm that the historical amount of \$([\d,.]+) USD was the agreed-upon monthly charge\.?/gi,
    "Los términos de la suscripción y facturas previas confirman que el monto histórico de $$$1 USD era el cargo mensual acordado."
  );

  // 3. Duplicate Charge Dispute Letter Sentences
  translated = translated.replace(
    /I am writing to dispute transaction ([a-z0-9_]+) for \$([\d,.]+) USD because it appears to be a duplicate charge\.?/gi,
    "Escribo para disputar la transacción $1 por $$$2 USD debido a que corresponde a un cobro duplicado."
  );

  translated = translated.replace(
    /My account was charged twice on ([^,]+) for the same amount \(\$([\d,.]+) USD\)\.?/gi,
    "Mi cuenta fue cobrada dos veces el $1 por el mismo monto ($$$2 USD)."
  );

  translated = translated.replace(
    /The initial charge was processed under transaction ([a-z0-9_]+) at ([^,]+),\s*and a duplicate charge of \$([\d,.]+) USD was posted under transaction ([a-z0-9_]+) just (\d+) minutes later at ([^.]+)\.?/gi,
    "El cobro inicial se procesó en la transacción $1 a las $2, y un cobro duplicado de $$$3 USD se registró en la transacción $4 tan solo $5 minutos después ($6)."
  );

  // 4. Transaction details table & closings
  translated = translated.replace(/Transaction details:/gi, "Detalles de la transacción:");
  translated = translated.replace(/- Transaction ID:/gi, "- ID de Transacción:");
  translated = translated.replace(/- Amount charged:/gi, "- Monto cobrado:");
  translated = translated.replace(/- Date posted:/gi, "- Fecha registrada:");
  translated = translated.replace(/- Subscription status at time of charge:/gi, "- Estado de suscripción al momento del cobro:");
  translated = translated.replace(/Cancelled \(as of ([^)]+)\)/gi, "Cancelada (al $1)");
  translated = translated.replace(/Active/gi, "Activa");

  translated = translated.replace(
    /I respectfully request a full refund of \$([\d,.]+) USD for this post-cancellation charge\.?/gi,
    "Solicito respetuosamente el reembolso total de $$$1 USD correspondiente a este cobro post-cancelación."
  );

  translated = translated.replace(
    /I respectfully request a refund of \$([\d,.]+) USD to adjust this transaction to the historical and expected amount\.?/gi,
    "Solicito respetuosamente un reembolso de $$$1 USD para ajustar esta transacción al monto histórico esperado."
  );

  translated = translated.replace(
    /I respectfully request a full refund of \$([\d,.]+) USD for the duplicate charge\.?/gi,
    "Solicito respetuosamente el reembolso total de $$$1 USD correspondiente al cobro duplicado."
  );

  translated = translated.replace(
    /Thank you for your prompt attention to this matter\.?/gi,
    "Agradezco de antemano su pronta atención a este caso."
  );

  translated = translated.replace(
    /Best regards,?/gi,
    "Atentamente,"
  );

  translated = translated.replace(
    /Sincerely,?/gi,
    "Atentamente,"
  );

  // 5. Anomaly analysis reasons (ChargeAnalysisAgent)
  translated = translated.replace(
    /The subscription was cancelled on ([^,]+),\s*but this charge was posted on ([^,]+),\s*which is (\d+) days after the cancellation date\.?/gi,
    "La suscripción fue cancelada el $1, pero este cobro fue registrado el $2 ($3 días después de la fecha de cancelación)."
  );

  translated = translated.replace(
    /The current ([A-Za-z0-9\s]+) charge of \$([\d,.]+) is \$([\d,.]+) higher than the established historical amount of \$([\d,.]+),\s*which has been consistent across (\d+) previous monthly transactions from ([A-Za-z]+) to ([A-Za-z]+ \d{4})\.?/gi,
    "El cobro actual de $1 de $$$2 es $$$3 superior al monto histórico establecido de $$$4, el cual se mantuvo consistente en $5 transacciones mensuales anteriores (de $6 a $7)."
  );

  translated = translated.replace(
    /The current charge of \$([\d,.]+) is \$([\d,.]+) higher than the established historical amount of \$([\d,.]+)[^.]*\.?/gi,
    "El cobro actual de $$$1 es $$$2 superior al monto histórico establecido de $$$3."
  );

  translated = translated.replace(
    /This represents a (\d+)% price increase\.?/gi,
    "Esto representa un incremento de precio del $1%."
  );

  translated = translated.replace(
    /The subscription was charged twice on ([A-Za-z0-9,\s]+) for the same amount \(\$([\d,.]+)\)[^.]*transaction ([a-z0-9_]+) was posted at ([0-9:Z]+) and current transaction ([a-z0-9_]+) at ([0-9:Z]+),\s*just (\d+) minutes apart[^.]*\.?/gi,
    "La suscripción se cobró dos veces el $1 por el mismo importe ($$$2). La transacción $3 se registró a las $4 y la transacción actual $5 a las $6, con tan solo $7 minutos de diferencia."
  );

  translated = translated.replace(
    /The current charge of \$([\d,.]+) matches the established historical pattern of monthly charges at the same amount\.?/gi,
    "El cobro actual de $$$1 coincide con el patrón histórico mensual por el mismo monto."
  );

  translated = translated.replace(
    /The subscription is active \(not cancelled\),\s*and this charge appears on the expected billing day \(([^)]+)\),\s*approximately one month after the previous charge\.?/gi,
    "La suscripción está activa (no cancelada) y este cobro aparece en el día de facturación esperado ($1), aproximadamente un mes después del cobro anterior."
  );

  translated = translated.replace(
    /No anomaly detected\.?/gi,
    "No se detectó ninguna anomalía."
  );

  translated = translated.replace(
    /Charge analyzed: legitimate recurring transaction, no anomaly detected/gi,
    "Cobro analizado: transacción recurrente legítima, sin anomalía detectada."
  );

  // 6. Evidence compilation sentences (EvidenceAgent)
  translated = translated.replace(
    /([A-Za-z0-9\s]+) subscription ([a-z0-9_]+) was cancelled on (\d{4}-\d{2}-\d{2})\.?/gi,
    "La suscripción de $1 ($2) fue cancelada el $3."
  );

  translated = translated.replace(
    /Transaction ([a-z0-9_]+) charged \$([\d,.]+) USD on ([0-9:TZ-]+)\.?/gi,
    "La transacción $1 cobró $$$2 USD el $3."
  );

  translated = translated.replace(
    /The charge occurred (\d+) days after cancellation\.?/gi,
    "El cobro ocurrió $1 días después de la cancelación."
  );

  translated = translated.replace(
    /A cancellation confirmation email is available\.?/gi,
    "Se dispone del correo de confirmación de cancelación."
  );

  translated = translated.replace(
    /The subscription status is cancelled\.?/gi,
    "El estado de la suscripción es cancelada."
  );

  translated = translated.replace(
    /The post-cancellation invoice is available\.?/gi,
    "La factura post-cancelación está disponible."
  );

  translated = translated.replace(
    /Subscription terms are available\.?/gi,
    "Los términos del contrato están disponibles."
  );

  translated = translated.replace(
    /The previous recurring charge for ([A-Za-z0-9\s]+) was \$([\d,.]+) USD,\s*while transaction ([a-z0-9_]+) charged \$([\d,.]+) USD\.?/gi,
    "El cobro recurrente anterior para $1 era de $$$2 USD, mientras que la transacción $3 cobró $$$4 USD."
  );

  translated = translated.replace(
    /Previous and current invoices are available\.?/gi,
    "Se dispone de facturas previas y actuales."
  );

  translated = translated.replace(
    /No price-change notification was found\.?/gi,
    "No se encontró notificación de cambio de precio."
  );

  translated = translated.replace(
    /Evidence package compiled: cancellation confirmation email, invoices, and terms/gi,
    "Paquete de evidencia compilado: confirmación de cancelación, facturas y términos."
  );

  translated = translated.replace(
    /Evidence package compiled: terms, invoices, and payment history/gi,
    "Paquete de evidencia compilado: términos del contrato, facturas e historial de pagos."
  );

  // 7. Negotiation Agent Sentences & Evaluation
  translated = translated.replace(
    /The evidence strongly supports the full refund claim\.?/gi,
    "La evidencia respalda sólidamente la solicitud de reembolso total."
  );

  translated = translated.replace(
    /The evidence strongly supports the full \$([\d,.]+) claim:?/gi,
    "La evidencia respalda sólidamente el reclamo por $$$1:"
  );

  translated = translated.replace(
    /The subscription was cancelled on ([^ ]+) with confirmation email available,\s*yet the charge occurred (\d+) days later on ([^.]+)\.?/gi,
    "La suscripción fue cancelada el $1 con confirmación disponible; no obstante, el cobro ocurrió $2 días después ($3)."
  );

  translated = translated.replace(
    /The cancelled subscription status,\s*post-cancellation invoice,\s*and subscription terms all document this unauthorized charge\.?/gi,
    "El estado cancelado, la factura y los términos documentan este cobro no autorizado."
  );

  translated = translated.replace(
    /The merchant's (\d+)% offer is not justified given the clear evidence that the entire \$([\d,.]+) charge was improper\.?/gi,
    "La oferta del $1% del comercio no se justifica, dada la clara evidencia de que el total del cobro de $$$2 fue indebido."
  );

  translated = translated.replace(
    /The merchant's (\d+)% partial offer does not align with the documented evidence showing an unannounced (\d+)% price increase\.?/gi,
    "La oferta parcial del $1% del comercio no concuerda con el aumento no anunciado del $2%."
  );

  translated = translated.replace(
    /(\d+) months of consistent \$([\d,.]+) charges,\s*verified price increase to \$([\d,.]+),\s*and critically,\s*no price-change notification was found\.?/gi,
    "$1 meses de cobros consistentes por $$$2, incremento verificado a $$$3 y, de manera crítica, ausencia de notificación previa."
  );

  translated = translated.replace(
    /Recommend rejecting and requesting the full refund amount supported by the evidence\.?/gi,
    "Se recomienda rechazar la oferta parcial y solicitar el reembolso total respaldado por la evidencia."
  );

  translated = translated.replace(
    /Recommend rejecting and requesting the full refund\.?/gi,
    "Se recomienda rechazar la contraoferta y exigir el reembolso total."
  );

  translated = translated.replace(
    /Recommend accepting the offer/gi,
    "Se recomienda aceptar la oferta"
  );

  translated = translated.replace(
    /Recommend accepting/gi,
    "Se recomienda aceptar"
  );

  // 8. Merchant Counter-offers & System Dispatches
  translated = translated.replace(
    /We can offer a one-time courtesy credit of \$([\d,.]+)\.?\s*(dólares\.?)?/gi,
    "Podemos ofrecerle un crédito de cortesía único de $$$1."
  );

  translated = translated.replace(
    /We can offer a courtesy credit of \$([\d,.]+)\.?\s*(dólares\.?)?/gi,
    "Podemos ofrecerle un crédito de cortesía de $$$1."
  );

  translated = translated.replace(
    /Merchant is reviewing the dispute claim\.?/gi,
    "El comercio está revisando la reclamación de la disputa."
  );

  translated = translated.replace(
    /Merchant counter-offered \$([\d,.]+) with message:\s*"?([^"\n]+)"?/gi,
    "El comercio envió una contraoferta de $$$1 con el mensaje: \"$2\""
  );

  translated = translated.replace(
    /Dispute filed with merchant: claim amount \$([\d,.]+)/gi,
    "Disputa presentada ante el comercio: monto reclamado $$$1 USD."
  );

  translated = translated.replace(
    /User requested a full refund/gi,
    "El usuario solicitó un reembolso total"
  );

  return translated;
}
