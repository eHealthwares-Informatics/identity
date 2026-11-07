export class Organization {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly isActive: boolean,
    public readonly domain: string | null,
  ) {}
}
