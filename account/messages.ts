"use client";

import { translator, useLocale, type Locale } from "@/lib/i18n";
import { ApiError } from "./api";

export const ACCOUNT_MESSAGES = {
  en: {
    title: "Account",
    signIn: "Sign in",
    signUp: "Create account",
    signInLead: "Sign in to pick up your games and streaks on any device.",
    signUpLead: "Create an account to keep your games and streaks, and play on any device.",
    guestNote: "Games already played on this device are added to your account.",
    toSignUp: "New here? Create an account",
    toSignIn: "Already have an account? Sign in",
    email: "E-mail",
    password: "Password",
    passwordHint: "At least 8 characters.",
    signedInAs: "Signed in as {email}.",
    syncNote: "Your games are saved to your account and follow you to other devices.",
    profile: "Profile",
    displayName: "Name",
    displayNameHint: "Optional. Up to 40 characters.",
    language: "Language",
    languageHint: "Saved to your account.",
    save: "Save",
    saved: "Saved.",
    changeEmail: "Change e-mail",
    newEmail: "New e-mail",
    emailChanged: "E-mail changed.",
    currentPassword: "Current password",
    changePassword: "Change password",
    newPassword: "New password",
    passwordChanged: "Password changed. Other devices were signed out.",
    signOut: "Sign out",
    signOutHint: "Your games stay in your account and are removed from this device.",
    deleteAccount: "Delete account",
    deleteWarning: "This permanently deletes your account and every game saved in it. It cannot be undone.",
    deleteConfirm: "Delete my account",
    errInvalidCredentials: "Wrong e-mail or password.",
    errEmailTaken: "There is already an account with this e-mail.",
    errWrongPassword: "That is not your current password.",
    errRateLimited: "Too many attempts. Wait a few minutes and try again.",
    errEmail: "Enter a valid e-mail address.",
    errPassword: "Use a password of 8 to 200 characters.",
    errName: "Use a name of up to 40 characters.",
    errNetwork: "Could not reach the server. Check your connection and try again.",
    errGeneric: "Something went wrong. Try again in a moment.",
  },
  pt: {
    title: "Conta",
    signIn: "Entrar",
    signUp: "Criar conta",
    signInLead: "Entre para continuar seus jogos e sequências em qualquer dispositivo.",
    signUpLead: "Crie uma conta para guardar seus jogos e sequências, e jogar em qualquer dispositivo.",
    guestNote: "Os jogos já feitos neste dispositivo entram na sua conta.",
    toSignUp: "Novo por aqui? Crie uma conta",
    toSignIn: "Já tem conta? Entre",
    email: "E-mail",
    password: "Senha",
    passwordHint: "Pelo menos 8 caracteres.",
    signedInAs: "Você entrou como {email}.",
    syncNote: "Seus jogos ficam salvos na conta e acompanham você em outros dispositivos.",
    profile: "Perfil",
    displayName: "Nome",
    displayNameHint: "Opcional. Até 40 caracteres.",
    language: "Idioma",
    languageHint: "Fica salvo na sua conta.",
    save: "Salvar",
    saved: "Salvo.",
    changeEmail: "Trocar e-mail",
    newEmail: "Novo e-mail",
    emailChanged: "E-mail alterado.",
    currentPassword: "Senha atual",
    changePassword: "Trocar senha",
    newPassword: "Nova senha",
    passwordChanged: "Senha alterada. Os outros dispositivos foram desconectados.",
    signOut: "Sair",
    signOutHint: "Seus jogos continuam na conta e saem deste dispositivo.",
    deleteAccount: "Excluir conta",
    deleteWarning: "Isso apaga para sempre a sua conta e todos os jogos salvos nela. Não dá para desfazer.",
    deleteConfirm: "Excluir minha conta",
    errInvalidCredentials: "E-mail ou senha incorretos.",
    errEmailTaken: "Já existe uma conta com este e-mail.",
    errWrongPassword: "Essa não é a sua senha atual.",
    errRateLimited: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    errEmail: "Digite um e-mail válido.",
    errPassword: "Use uma senha de 8 a 200 caracteres.",
    errName: "Use um nome de até 40 caracteres.",
    errNetwork: "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.",
    errGeneric: "Algo deu errado. Tente de novo em instantes.",
  },
} satisfies Record<Locale, Record<string, string>>;

type Key = keyof (typeof ACCOUNT_MESSAGES)["en"];

export function useAccountT() {
  return translator(ACCOUNT_MESSAGES, useLocale());
}

const BY_CODE: Record<string, Key> = {
  invalid_credentials: "errInvalidCredentials",
  email_taken: "errEmailTaken",
  wrong_password: "errWrongPassword",
  rate_limited: "errRateLimited",
  network: "errNetwork",
};

const BY_FIELD: Record<string, Key> = {
  email: "errEmail",
  password: "errPassword",
  newPassword: "errPassword",
  currentPassword: "errWrongPassword",
  displayName: "errName",
};

/** The message to show for a failed account action. */
export function errorKey(error: unknown): Key {
  if (!(error instanceof ApiError)) return "errGeneric";
  if (error.code === "invalid" && error.field) return BY_FIELD[error.field] ?? "errGeneric";
  return BY_CODE[error.code] ?? "errGeneric";
}
