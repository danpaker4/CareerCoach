export const Login = {
  signIn: 'signIn',
  signUp: 'signUp',
} as const

export type LoginType = typeof Login[keyof typeof Login]

