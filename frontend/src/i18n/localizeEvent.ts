import type { Language } from "./translations";

/**
 * Translates agent-generated English texts (anomaly analyses, evidence summaries,
 * dispute letters, merchant offers, dates, decision actions, and negotiation recommendations)
 * into natural Spanish when language === "es", while keeping dynamic values intact.
 */
export function localizeText(text: string | null | undefined, language: Language): string {
  if (!text) return "";
  if (language === "en") return text;

  let translated = text;

  // 1. Decision actions (e.g. in step 6)
  translated = translated.replace(/\breject_and_request_full_refund\b/gi, "Rechazar contraoferta y solicitar reembolso total");
  translated = translated.replace(/\baccept_offer\b/gi, "Aceptar contraoferta");
  translated = translated.replace(/User requested a full refund/gi, "El usuario solicitó un reembolso total");

  // 2. Dispute Letter Sentences & Paragraphs
  translated = translated.replace(
    /Dear ([^,:\n]+)[,:]/gi,
    "Estimado equipo de $1:"
  );

  translated = translated.replace(
    /I am writing to dispute a duplicate charge on my account\.?/gi,
    "Escribo para disputar un cobro duplicado en mi cuenta."
  );

  translated = translated.replace(
    /(?:On|on) ([^,]+),\s*my ([A-Za-z0-9\s]+) subscription was charged twice for the same service on the same day:?/gi,
    "El $1, mi suscripción a $2 fue cobrada dos veces por el mismo servicio en el mismo día:"
  );

  translated = translated.replace(
    /- Transaction ([a-z0-9_]+):\s*\$([\d,.]+) USD charged at ([0-9:]+) UTC\s*\(([^)]+)\)/gi,
    "- Transacción $1: $$$2 USD cobrados a las $3 UTC ($4)"
  );

  translated = translated.replace(
    /- Transaction ([a-z0-9_]+):\s*\$([\d,.]+) USD charged at ([0-9:]+) UTC/gi,
    "- Transacción $1: $$$2 USD cobrados a las $3 UTC"
  );

  translated = translated.replace(
    /Both charges are identical in amount and occurred within an unusually short timeframe of only (\d+) seconds,\s*indicating that the second charge \(([^)]+)\) is a duplicate of the first legitimate subscription charge\.?/gi,
    "Ambos cobros son idénticos en monto y ocurrieron en un lapso inusualmente corto de solo $1 segundos, lo que indica que el segundo cobro ($2) es un duplicado del primer cobro legítimo de la suscripción."
  );

  translated = translated.replace(
    /Both charges are identical in amount and occurred within an unusually short timeframe of only (\d+) seconds[^.]*\.?/gi,
    "Ambos cobros son idénticos en monto y ocurrieron en un lapso inusualmente corto de solo $1 segundos."
  );

  translated = translated.replace(
    /I have only one active ([A-Za-z0-9\s]+) subscription and should have been charged only once for this billing cycle\.?/gi,
    "Tengo una sola suscripción activa a $1 y debí haber sido cobrado una sola vez para este ciclo de facturación."
  );

  translated = translated.replace(
    /I request a refund of the full duplicated charge amount of \$([\d,.]+) USD for transaction ([a-z0-9_]+)\.?/gi,
    "Solicito el reembolso del monto total del cobro duplicado de $$$1 USD correspondiente a la transacción $2."
  );

  translated = translated.replace(
    /I request a refund of the full duplicated charge amount of \$([\d,.]+) USD\.?/gi,
    "Solicito el reembolso del monto total del cobro duplicado de $$$1 USD."
  );

  translated = translated.replace(
    /(\d+) minutes later/gi,
    "$1 minutos después"
  );

  translated = translated.replace(
    /I am writing to dispute a charge on my account regarding transaction ([a-z0-9_]+) for \$([\d,.]+) USD\.?/gi,
    "Escribo para disputar un cargo en mi cuenta correspondiente a la transacción $1 por $$$2 USD."
  );

  translated = translated.replace(
    /I am writing to dispute a charge that was posted to my account after my subscription cancellation\.?/gi,
    "Escribo para disputar un cargo registrado en mi cuenta con posterioridad a la cancelación de mi suscripción."
  );

  translated = translated.replace(
    /I am writing to dispute transaction ([a-z0-9_]+) for \$([\d,.]+) USD due to an unjustified price increase on my subscription\.?/gi,
    "Escribo para disputar la transacción $1 por $$$2 USD debido a un incremento de precio no justificado en mi suscripción."
  );

  translated = translated.replace(
    /I am writing to dispute transaction ([a-z0-9_]+) for \$([\d,.]+) USD because it appears to be a duplicate charge\.?/gi,
    "Escribo para disputar la transacción $1 por $$$2 USD debido a que corresponde a un cobro duplicado."
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

  translated = translated.replace(
    /my ([A-Za-z0-9\s]+) subscription was consistently charged at \$([\d,.]+) USD per billing cycle\.?/gi,
    "mi suscripción a $1 se cobró consistentemente a $$$2 USD por ciclo de facturación."
  );

  translated = translated.replace(
    /For (\d+) consecutive months from ([^,]+),\s*my ([A-Za-z0-9\s]+) subscription charge remained consistent at \$([\d,.]+) USD\.?/gi,
    "Durante $1 meses consecutivos ($2), el cobro de mi suscripción a $3 se mantuvo consistente en $$$4 USD."
  );

  translated = translated.replace(
    /The current charge of \$([\d,.]+) USD represents an unexpected increase of \$([\d,.]+) USD \((?:approximately )?(\d+)%\) from the established rate\.?/gi,
    "El cobro actual de $$$1 USD representa un incremento inesperado de $$$2 USD (aproximadamente el $3%) respecto a la tarifa acordada."
  );

  translated = translated.replace(
    /However, the current charge has increased to \$([\d,.]+) USD,\s*representing a \$([\d,.]+) increase or (\d+)% above my established billing history\.?/gi,
    "Sin embargo, el cobro actual aumentó a $$$1 USD, lo que representa un incremento de $$$2 USD ($3% por encima de mi historial de facturación)."
  );

  translated = translated.replace(
    /I have not authorized this price increase and do not recall receiving notice of a change to my subscription terms\.?/gi,
    "No he autorizado este incremento de precio ni he recibido notificación de un cambio en los términos de mi suscripción."
  );

  translated = translated.replace(
    /I have not received any notification of a plan change or pricing adjustment that would justify this increase\.?/gi,
    "No he recibido notificación alguna de cambio de plan o ajuste tarifario que justifique este incremento."
  );

  translated = translated.replace(
    /I request a refund of the \$([\d,.]+) USD difference to restore the charge to the historical subscription amount of \$([\d,.]+) USD\.?/gi,
    "Solicito el reembolso de la diferencia de $$$1 USD para restablecer el cobro al monto histórico de la suscripción de $$$2 USD."
  );

  translated = translated.replace(
    /My subscription terms and previous invoices confirm that the historical amount of \$([\d,.]+) USD was the agreed-upon monthly charge\.?/gi,
    "Los términos de la suscripción y facturas previas confirman que el monto histórico de $$$1 USD era el cargo mensual acordado."
  );

  translated = translated.replace(
    /Please review this matter and advise on the reason for this increase\.?/gi,
    "Por favor revisen este asunto e infórmenme sobre el motivo de este incremento."
  );

  translated = translated.replace(
    /I have retained copies of my invoices and transaction history to support this dispute\.?/gi,
    "He conservado copias de mis facturas e historial de transacciones como respaldo de esta disputa."
  );

  translated = translated.replace(
    /My account was charged twice on ([^,]+) for the same amount \(\$([\d,.]+) USD\)\.?/gi,
    "Mi cuenta fue cobrada dos veces el $1 por el mismo monto ($$$2 USD)."
  );

  translated = translated.replace(
    /The initial charge was processed under transaction ([a-z0-9_]+) at ([^,]+),\s*and a duplicate charge of \$([\d,.]+) USD was posted under transaction ([a-z0-9_]+) just (\d+) minutes later at ([^.]+)\.?/gi,
    "El cobro inicial se procesó en la transacción $1 a las $2, y un cobro duplicado de $$$3 USD se registró en la transacción $4 tan solo $5 minutos después ($6)."
  );

  // 3. Granular Anomaly Reasons & Dashboard clauses (Price increase / Legitimate / Duplicate / Post cancellation)
  translated = translated.replace(
    /The current ([A-Za-z0-9\s]+) charge of \$([\d,.]+) is \$([\d,.]+) higher than the established historical amount of \$([\d,.]+)/gi,
    "El cobro actual de $1 de $$$2 es $$$3 superior al monto histórico establecido de $$$4"
  );

  translated = translated.replace(
    /The current charge of \$([\d,.]+) is \$([\d,.]+) higher than the established historical amount of \$([\d,.]+)/gi,
    "El cobro actual de $$$1 es $$$2 superior al monto histórico establecido de $$$3"
  );

  translated = translated.replace(
    /that was consistently charged (?:from|de) ([^.]+)/gi,
    "(cobrado consistentemente de $1)"
  );

  translated = translated.replace(
    /that was consistently charged ([^.]+)/gi,
    "(cobrado consistentemente $1)"
  );

  translated = translated.replace(
    /This represents a (\d+)% price increase\.?(?:\s*from the base subscription amount\.?)?/gi,
    "Esto representa un incremento de precio del $1% respecto a la suscripción base."
  );

  translated = translated.replace(
    /The current charge of \$([\d,.]+) matches the established historical pattern of monthly charges/gi,
    "El cobro actual de $$$1 coincide con el patrón histórico mensual de cobros"
  );

  translated = translated.replace(
    /The current ([A-Za-z0-9\s]+) charge of \$([\d,.]+) matches the established historical pattern/gi,
    "El cobro actual de $1 de $$$2 coincide con el patrón histórico establecido"
  );

  translated = translated.replace(
    /The current charge of \$([\d,.]+) matches the established historical pattern/gi,
    "El cobro actual de $$$1 coincide con el patrón histórico establecido"
  );

  translated = translated.replace(
    /All previous transactions (?:from|de) ([^ ]+) (?:to|through|a) ([^ ]+ \d{4}) were consistently \$([\d,.]+)/gi,
    "Todas las transacciones previas de $1 a $2 fueron consistentemente de $$$3"
  );

  translated = translated.replace(
    /All previous transactions ([^.]+?) were consistently \$([\d,.]+)/gi,
    "Todas las transacciones previas $1 fueron consistentemente de $$$2"
  );

  translated = translated.replace(
    /The subscription is (?:active|Active|Activa), not cancelled,\s*and this charge follows the expected monthly billing cycle with no price change or duplication\.?/gi,
    "La suscripción está activa (no cancelada) y este cobro sigue el ciclo de facturación mensual esperado sin cambios de precio ni duplicidad."
  );

  translated = translated.replace(
    /The subscription is (?:Active|Activa) with no cancellation date,\s*and the amount is consistent with the base subscription price and all previous transactions\.?/gi,
    "La suscripción está activa sin fecha de cancelación, y el monto es consistente con el precio base y todas las transacciones previas."
  );

  translated = translated.replace(
    /The subscription was cancelled on ([^,]+),\s*but this charge was posted on ([^,]+),\s*which is (\d+) days after the cancellation date\.?/gi,
    "La suscripción fue cancelada el $1, pero este cobro fue registrado el $2 ($3 días después de la fecha de cancelación)."
  );

  translated = translated.replace(
    /Duplicate charge detected:\s*The same ([A-Za-z0-9\s]+) subscription was charged twice on ([^ ]+) - once at ([^ ]+) \(([^)]+)\) and again at ([^ ]+) \(([^)]+)\), both for \$([\d,.]+)\.\s*These charges occurred only (\d+) minutes apart on the same billing day,\s*indicating the second charge is a duplicate\.?/gi,
    "Cobro duplicado detectado: La misma suscripción de $1 fue cobrada dos veces el $2 (una vez a las $3 en $4 y otra a las $5 en $6, ambas por $$$7). Estos cobros ocurrieron con solo $8 minutos de diferencia en el mismo día de facturación, lo que indica que el segundo cobro es un duplicado."
  );

  translated = translated.replace(
    /The subscription was charged twice on ([A-Za-z0-9,\s]+) for the same amount \(\$([\d,.]+)\)[^.]*transaction ([a-z0-9_]+) was posted at ([0-9:Z]+) and current transaction ([a-z0-9_]+) at ([0-9:Z]+),\s*just (\d+) minutes apart[^.]*\.?/gi,
    "La suscripción se cobró dos veces el $1 por el mismo importe ($$$2). La transacción $3 se registró a las $4 y la transacción actual $5 a las $6, con tan solo $7 minutos de diferencia."
  );

  translated = translated.replace(
    /The subscription is (?:active|Active|Activa) \(not cancelled\),\s*and this charge appears on the expected billing day \(([^)]+)\),\s*approximately one month after the previous charge\.?/gi,
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

  // 4. Evidence compilation sentences
  translated = translated.replace(
    /Transactions ([a-z0-9_]+) and ([a-z0-9_]+) charged \$([\d,.]+) USD for the same ([A-Za-z0-9\s]+) subscription\.?/gi,
    "Las transacciones $1 y $2 cobraron $$$3 USD por la misma suscripción de $4."
  );

  translated = translated.replace(
    /The charges occurred (\d+) seconds apart\.?/gi,
    "Los cobros ocurrieron con $1 segundos de diferencia."
  );

  translated = translated.replace(
    /Invoices for both transactions are available\.?/gi,
    "Las facturas de ambas transacciones están disponibles."
  );

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

  // 5. Negotiation Agent Sentences & Evaluation
  translated = translated.replace(
    /The evidence strongly supports the full refund claim\.?/gi,
    "La evidencia respalda sólidamente la solicitud de reembolso total."
  );

  translated = translated.replace(
    /The evidence strongly supports the full \$([\d,.]+) claim:?/gi,
    "La evidencia respalda sólidamente el reclamo por $$$1:"
  );

  translated = translated.replace(
    /documented price history shows consistent \$([\d,.]+) charges,\s*current charge is \$([\d,.]+),\s*and critically,?\s*(?:No se encontró notificación de cambio de precio\.?|no price-change notification was found\.?)?/gi,
    "el historial documentado muestra cobros consistentes por $$$1, el cobro actual es de $$$2 y, críticamente, no se encontró notificación de cambio de precio."
  );

  translated = translated.replace(
    /A (\d+)% price increase without proper notification warrants the full refund\.?/gi,
    "Un incremento de precio del $1% sin notificación previa amerita el reembolso total."
  );

  translated = translated.replace(
    /The merchant's (\d+)% partial offer does not adequately address the lack of notification for this significant price change\.?/gi,
    "La oferta parcial del $1% del comercio no compensa adecuadamente la falta de notificación de este significativo cambio de precio."
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

  // 6. Dates and Months
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

  translated = translated.replace(/\b(?:from|From) April (?:through|to) August (\d{4})\b/gi, "de abril a agosto de $1");
  translated = translated.replace(/\bApril through August (\d{4})\b/gi, "abril a agosto de $1");
  translated = translated.replace(/\bApril to August (\d{4})\b/gi, "abril a agosto de $1");
  translated = translated.replace(/\bon the (\d+)(?:st|nd|rd|th)? of each month\b/gi, "el día $1 de cada mes");

  // 7. Transaction details table & closings
  translated = translated.replace(/Transaction details:/gi, "Detalles de la transacción:");
  translated = translated.replace(/- Transaction ID:/gi, "- ID de Transacción:");
  translated = translated.replace(/- Amount charged:/gi, "- Monto cobrado:");
  translated = translated.replace(/- Date posted:/gi, "- Fecha registrada:");
  translated = translated.replace(/- Subscription status at time of charge:/gi, "- Estado de suscripción al momento del cobro:");
  translated = translated.replace(/Cancelled \(as of ([^)]+)\)/gi, "Cancelada (al $1)");
  translated = translated.replace(/\bActive\b/g, "Activa");

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

  // Clean up any double periods or awkward spacing
  translated = translated.replace(/\.\.+/g, ".");
  translated = translated.replace(/\s+,/g, ",");
  translated = translated.replace(/\(\s+/g, "(");
  translated = translated.replace(/\s+\)/g, ")");

  return translated;
}
