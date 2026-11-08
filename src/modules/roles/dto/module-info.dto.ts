export class ModuleInfoDto {
  id!: string;
  name!: string;
  description!: string;
  root!: string;
  /**
   * Permission roots that grant this module, when they differ from its id.
   * Login/`/auth/me` permissions are compressed (a granted parent drops its
   * children), so an org owner holds `rxsoft.identity` rather than the
   * individual `…user.read` codes — matching on the id alone would hide these
   * modules. Defaults to `[id]` when omitted.
   */
  permissionRoots?: string[];
}
