export class Location {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly code: string,
    public readonly name: string,
    public readonly parentId: string | null,
    public readonly isActive: boolean,
  ) {}
}
