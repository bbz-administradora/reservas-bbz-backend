import { VerificationTokenType } from '@/repositories/base/verification-tokens-repository'
import { PgVerificationTokenRepository } from '@/repositories/pg/pg-verification-tokens-repository'
import { generateOTP } from '@/utils/password'
import { addDays } from 'date-fns'
import { v4 } from 'uuid'

interface CreateVerificationTokenInput {
  userId: string
  tokenType: VerificationTokenType
  expiresInDays?: number
}

/**
 * Creates a new verification token for a user.
 *
 * This model generates a verification token record in the database, typically used
 * for email verification, password resets, and similar operations requiring secure token validation.
 *
 * @param input - Information required to generate the verification token:
 *  - userId: The unique identifier of the user.
 *  - tokenType: The type of verification token (e.g., EMAIL_VERIFICATION, PASSWORD_RESET).
 *  - expiresInDays: (Optional) Number of days until the token expires. Default is 1 day.
 *
 * @returns An object containing details of the created verification token, including the token itself.
 */
export async function createVerificationToken({
  userId,
  tokenType,
  expiresInDays = 1,
}: CreateVerificationTokenInput) {
  const verificationTokenRepository = new PgVerificationTokenRepository()

  const expires = addDays(new Date(), expiresInDays)

  // 📌 Check if a token already exists for the user and token type
  let tokenData = await verificationTokenRepository.findTokenByTypeAndUserId(
    userId,
    tokenType,
  )

  if (tokenData) {
    tokenData = await verificationTokenRepository.update({
      userId,
      tokenType,
      expires,
      token: v4(),
      opt: generateOTP(),
    })
  } else {
    tokenData = await verificationTokenRepository.create({
      userId,
      tokenType,
      expires,
    })
  }

  return tokenData
}
