export type Factory<TBuild, TCreate = TBuild> = {
  build(overrides?: Partial<TBuild>): TBuild
  create(overrides?: Partial<TBuild>): Promise<TCreate>
}
