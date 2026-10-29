const DEFAULT_MAX_LENGTH = {
  text: 255,
  name: 100,
  address: 255,
  phone: 20,
  whatsapp_number: 20,
  email: 254,
  nic: 12,
  date: 10,
  select: 255,
};

export function vitalMaxLength(spec) {
  if (!spec) return null;
  return spec.maxLength ?? DEFAULT_MAX_LENGTH[spec.inputType?.toLowerCase()] ?? 255;
}

export function validateVitalAnswer(spec, value) {
  if (!spec) return null;
  const type = spec.inputType?.toLowerCase() || "text";
  const answer = value?.trim() || "";
  if (!answer) return spec.required ? "Required" : "Please enter a value or choose Skip";

  const maxLength = vitalMaxLength(spec);
  if (maxLength != null && answer.length > maxLength) return `Maximum ${maxLength} characters`;

  if (type === "date") {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(answer);
    if (!match) return spec.validationMessage || "Please enter a valid date (DD/MM/YYYY)";
    const [, day, month, year] = match;
    const parsed = new Date(0);
    parsed.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1
      || parsed.getUTCDate() !== Number(day)) {
      return spec.validationMessage || "Please enter a valid date (DD/MM/YYYY)";
    }
  }

  if (["text", "name", "address"].includes(type)) {
    const controls = type === "address" ? /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/
      : /[\u0000-\u001F\u007F-\u009F]/;
    if (controls.test(answer)) return "Control characters are not allowed";
  }
  if (type === "phone" || type === "whatsapp_number") {
    const digitCount = (answer.match(/[0-9]/g) || []).length;
    if (!/^\+?[0-9 ()-]+$/.test(answer) || digitCount < 7 || digitCount > 15) {
      return "Enter a phone number with 7–15 digits";
    }
  }
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) {
    return "Enter a valid email address";
  }
  if (type === "nic" && !/^(?:[0-9]{9}[vVxX]|[0-9]{12})$/.test(answer)) {
    return "Enter a valid Sri Lankan NIC";
  }

  if (spec.validationRegex && type !== "select" && type !== "file") {
    try {
      if (!new RegExp(spec.validationRegex).test(answer)) {
        return spec.validationMessage || "Invalid data";
      }
    } catch {
      return "This field is temporarily unavailable";
    }
  }
  return null;
}
