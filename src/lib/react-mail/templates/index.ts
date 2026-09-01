// src/lib/react-mail/templates/index.ts

import {
  DirectorComplianceAlertProps,
  DirectorComplianceAlertTemplate,
} from '../emails/director-compliance-alert'
import {
  EarlyCheckoutReminderProps,
  EarlyCheckoutReminderTemplate,
} from '../emails/early-checkout-reminder'
import {
  ForgotPasswordProps,
  ForgotPasswordTemplate,
} from '../emails/forgot-password'
import {
  ManagerNominationProps,
  ManagerNominationTemplate,
} from '../emails/manager-nomination'
import {
  MemberNominationProps,
  MemberNominationTemplate,
} from '../emails/member-nomination'
import {
  SpaceAttendanceReminderProps,
  SpaceAttendanceReminderTemplate,
} from '../emails/space-attendance-reminder'
import {
  SpaceReservationConfirmationProps,
  SpaceReservationConfirmationTemplate,
} from '../emails/space-reservation-confirmation'
import {
  SupervisorComplianceAlertProps,
  SupervisorComplianceAlertTemplate,
} from '../emails/supervisor-compliance-alert'
import {
  SupervisorNominationProps,
  SupervisorNominationTemplate,
} from '../emails/supervisor-nomination'
import {
  SupervisorReservationCancelledProps,
  SupervisorReservationCancelledTemplate,
} from '../emails/supervisor-reservation-cancelled'
import {
  TeamNominationProps,
  TeamNominationTemplate,
} from '../emails/team-nomination'
import {
  WeeklyComplianceReminderProps,
  WeeklyComplianceReminderTemplate,
} from '../emails/weekly-compliance-reminder'

export interface EmailDataMap {
  SPACE_RESERVATION_CONFIRMATION: SpaceReservationConfirmationProps
  FORGOT_PASSWORD: ForgotPasswordProps
  SPACE_ATTENDANCE_REMINDER: SpaceAttendanceReminderProps
  MANAGER_NOMINATION: ManagerNominationProps
  MEMBER_NOMINATION: MemberNominationProps
  SUPERVISOR_NOMINATION: SupervisorNominationProps
  TEAM_NOMINATION: TeamNominationProps
  WEEKLY_COMPLIANCE_REMINDER: WeeklyComplianceReminderProps
  SUPERVISOR_COMPLIANCE_ALERT: SupervisorComplianceAlertProps
  DIRECTOR_COMPLIANCE_ALERT: DirectorComplianceAlertProps
  EARLY_CHECKOUT_REMINDER: EarlyCheckoutReminderProps
  SUPERVISOR_RESERVATION_CANCELLED: SupervisorReservationCancelledProps
  // Add other email data types as needed
}

export type EmailType = keyof EmailDataMap

interface EmailTemplate<T> {
  subject: string

  render: (data: T) => Promise<{ html: string; text: string }>
}

type EmailTemplates = {
  [K in EmailType]: EmailTemplate<EmailDataMap[K]>
}

const emailTemplates: EmailTemplates = {
  SPACE_RESERVATION_CONFIRMATION: SpaceReservationConfirmationTemplate,
  FORGOT_PASSWORD: ForgotPasswordTemplate,
  SPACE_ATTENDANCE_REMINDER: SpaceAttendanceReminderTemplate,
  MANAGER_NOMINATION: ManagerNominationTemplate,
  MEMBER_NOMINATION: MemberNominationTemplate,
  SUPERVISOR_NOMINATION: SupervisorNominationTemplate,
  TEAM_NOMINATION: TeamNominationTemplate,
  WEEKLY_COMPLIANCE_REMINDER: WeeklyComplianceReminderTemplate,
  SUPERVISOR_COMPLIANCE_ALERT: SupervisorComplianceAlertTemplate,
  DIRECTOR_COMPLIANCE_ALERT: DirectorComplianceAlertTemplate,
  EARLY_CHECKOUT_REMINDER: EarlyCheckoutReminderTemplate,
  SUPERVISOR_RESERVATION_CANCELLED: SupervisorReservationCancelledTemplate,
  // Add other email templates as needed
}

export default emailTemplates
