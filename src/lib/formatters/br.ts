export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpfOrCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatBrazilPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatCurrencyInput(value: string) {
  const digits = onlyDigits(value).slice(0, 12);

  if (!digits) {
    return "";
  }

  const integerValue = Number(digits) / 100;

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(integerValue);
}

export function formatStoredCurrencyInput(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const parsedValue = typeof value === "number" ? value : Number(String(value));

  if (!Number.isFinite(parsedValue)) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsedValue);
}

export function formatPercentageInput(value: string) {
  const sanitized = value.replaceAll(".", ",").replace(/[^\d,]/g, "");

  if (!sanitized) {
    return "";
  }

  const [rawInteger = "", ...rawDecimals] = sanitized.split(",");
  const integerDigits = rawInteger.slice(0, 3).replace(/^0+(?=\d)/, "") || rawInteger.slice(0, 3);
  const decimalDigits = rawDecimals.join("").slice(0, 2);

  return decimalDigits ? `${integerDigits},${decimalDigits}` : integerDigits;
}

export function normalizeCurrencyToDecimalString(value: string) {
  const digits = onlyDigits(value);

  if (!digits) {
    return "";
  }

  const normalized = digits.padStart(3, "0");
  const integerPart = normalized.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const decimalPart = normalized.slice(-2);

  return `${integerPart}.${decimalPart}`;
}

export function normalizePercentageToDecimalString(value: string) {
  const sanitized = value.replace("%", "").trim().replace(/\s+/g, "");

  if (!sanitized) {
    return "";
  }

  const normalized =
    sanitized.includes(",")
      ? sanitized.replaceAll(".", "").replace(",", ".")
      : sanitized.replace(",", ".");

  const parsedValue = Number(normalized);

  if (!Number.isFinite(parsedValue)) {
    return "";
  }

  return parsedValue.toFixed(2);
}

export function formatCurrencyBRL(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "R$ 0,00";
  }

  const parsedValue = typeof value === "number" ? value : Number(String(value));

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(parsedValue) ? parsedValue : 0);
}

export function formatPercentageBR(
  value: string | number | null | undefined,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
) {
  if (value === null || value === undefined || value === "") {
    return "0,00%";
  }

  const parsedValue = typeof value === "number" ? value : Number(String(value));
  const minimumFractionDigits = options?.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;

  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Number.isFinite(parsedValue) ? parsedValue : 0)}%`;
}

function allDigitsEqual(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);

  if (digits.length !== 11 || allDigitsEqual(digits)) {
    return false;
  }

  let sum = 0;

  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }

  let remainder = (sum * 10) % 11;

  if (remainder === 10) {
    remainder = 0;
  }

  if (remainder !== Number(digits[9])) {
    return false;
  }

  sum = 0;

  for (let index = 0; index < 10; index += 1) {
    sum += Number(digits[index]) * (11 - index);
  }

  remainder = (sum * 10) % 11;

  if (remainder === 10) {
    remainder = 0;
  }

  return remainder === Number(digits[10]);
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);

  if (digits.length !== 14 || allDigitsEqual(digits)) {
    return false;
  }

  const calculateDigit = (base: string, factors: number[]) => {
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * factors[index], 0);

    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return firstDigit === Number(digits[12]) && secondDigit === Number(digits[13]);
}

export function isValidCpfOrCnpj(value: string) {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return isValidCpf(digits);
  }

  if (digits.length === 14) {
    return isValidCnpj(digits);
  }

  return false;
}

export function isValidBrazilPhone(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}
