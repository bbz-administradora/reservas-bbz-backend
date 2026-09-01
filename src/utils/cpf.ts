export function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cpf.charAt(9))) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cpf.charAt(10))) return false

  return true
}

export function generateCPF(masked = false): string {
  // Gera 9 dígitos aleatórios
  const randomDigits = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10),
  )

  const calculateDigit = (digits: number[]): number => {
    const sum = digits.reduce(
      (acc, digit, index) => acc + digit * (digits.length + 1 - index),
      0,
    )
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const d1 = calculateDigit(randomDigits)
  const d2 = calculateDigit([...randomDigits, d1])

  const fullCpfArray = [...randomDigits, d1, d2]
  const fullCpf = fullCpfArray.join('')

  if (!masked) return fullCpf

  // Formatar com máscara: 000.000.000-00
  return (
    fullCpf.slice(0, 3) +
    '.' +
    fullCpf.slice(3, 6) +
    '.' +
    fullCpf.slice(6, 9) +
    '-' +
    fullCpf.slice(9, 11)
  )
}
