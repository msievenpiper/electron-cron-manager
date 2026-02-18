export interface CronFields {
  minute: string  // '0'–'59' or '*'
  hour: string    // '0'–'23' or '*'
  dom: string     // '1'–'31' or '*'
  month: string   // '1'–'12' or '*'
  dow: string     // '0'–'6' or '*'
}

const FALLBACK_FIELDS: CronFields = { minute: '*', hour: '*', dom: '*', month: '*', dow: '*' }

function normalizeField(val: string): string {
  return /[\/\-,]/.test(val) ? '*' : val
}

export function parseCronToFields(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return { ...FALLBACK_FIELDS }
  const [minute, hour, dom, month, dow] = parts
  return {
    minute: normalizeField(minute),
    hour: normalizeField(hour),
    dom: normalizeField(dom),
    month: normalizeField(month),
    dow: normalizeField(dow),
  }
}

export function buildCronFromFields(fields: CronFields): string {
  return `${fields.minute} ${fields.hour} ${fields.dom} ${fields.month} ${fields.dow}`
}
