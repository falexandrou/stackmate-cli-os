import { LocalBackend } from 'cdktf';

import { PROVIDER } from '@stackmate/engine/constants';
import { JsonSchema } from '@stackmate/engine/types/schema';
import { Attribute, AttributesOf, NonAttributesOf } from '@stackmate/engine/types/entity';
import { BaseCloudService, BaseProviderService, BaseStateService } from '@stackmate/engine/types/service/base';

type LocalService<Srv extends BaseCloudService> = Srv & {
  readonly provider: Attribute<typeof PROVIDER.LOCAL>;
}
type LocalBaseService = LocalService<BaseCloudService> & {
  providerService: Local.Provider.Type;
}
type LocalProviderService = LocalService<BaseProviderService>;
type LocalStateService = LocalService<BaseStateService> & {
  directory: Attribute<string>;
  backendResource: LocalBackend;
  get path(): string;
};

export namespace Local {
  export namespace Base {
    export type Attributes = AttributesOf<LocalBaseService>;
    export type Type = Attributes & NonAttributesOf<LocalBaseService>;
    export type Schema = JsonSchema<Attributes>;
  }
  export namespace Provider {
    export type Attributes = AttributesOf<LocalProviderService>;
    export type Type = Attributes & NonAttributesOf<LocalProviderService>;
    export type Schema = JsonSchema<Attributes>;
  }
  export namespace State {
    export type Attributes = AttributesOf<LocalStateService>;
    export type Type = Attributes & NonAttributesOf<LocalStateService>;
    export type Schema = JsonSchema<Attributes>;
  }
}