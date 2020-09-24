

export enum KnownScope {
  singleton = "singleton",
  instance = "instance"
}

export type KnownScopes = keyof typeof KnownScope

export type Scopes = KnownScopes | string
