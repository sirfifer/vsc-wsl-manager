[VSC WSL Manager API - v0.0.1](../README.md) / [Modules](../modules.md) / [wslManager](../modules/wslManager.md) / WSLManager

# Class: WSLManager

[wslManager](../modules/wslManager.md).WSLManager

Manages WSL distributions and operations

**`Example`**

```typescript
const manager = new WSLManager();
const distributions = await manager.listDistributions();
```

## Table of contents

### Constructors

- [constructor](wslManager.WSLManager.md#constructor)

### Methods

- [createDistribution](wslManager.WSLManager.md#createdistribution)
- [exportDistribution](wslManager.WSLManager.md#exportdistribution)
- [getDistributionInfo](wslManager.WSLManager.md#getdistributioninfo)
- [importDistribution](wslManager.WSLManager.md#importdistribution)
- [listDistributions](wslManager.WSLManager.md#listdistributions)
- [runCommand](wslManager.WSLManager.md#runcommand)
- [setDefaultDistribution](wslManager.WSLManager.md#setdefaultdistribution)
- [terminateDistribution](wslManager.WSLManager.md#terminatedistribution)
- [unregisterDistribution](wslManager.WSLManager.md#unregisterdistribution)

## Constructors

### constructor

• **new WSLManager**(): [`WSLManager`](wslManager.WSLManager.md)

#### Returns

[`WSLManager`](wslManager.WSLManager.md)

## Methods

### createDistribution

▸ **createDistribution**(`name`, `baseDistro`): `Promise`\<`void`\>

Creates a new WSL distribution by cloning an existing one

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | Name for the new distribution |
| `baseDistro` | `string` | Name of the existing distribution to clone |

#### Returns

`Promise`\<`void`\>

**`Throws`**

When distribution name is invalid or base distribution doesn't exist

**`Throws`**

For security violations or operation failures

**`Example`**

```typescript
await wslManager.createDistribution('my-dev-env', 'Ubuntu');
```

#### Defined in

[wslManager.ts:140](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L140)

___

### exportDistribution

▸ **exportDistribution**(`name`, `exportPath`): `Promise`\<`void`\>

Exports a WSL distribution to a TAR file

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | Name of the distribution to export |
| `exportPath` | `string` | Path where the TAR file will be saved |

#### Returns

`Promise`\<`void`\>

**`Throws`**

When inputs are invalid

**`Throws`**

When distribution doesn't exist or export fails

**`Example`**

```typescript
await wslManager.exportDistribution('Ubuntu', '/backups/ubuntu-backup.tar');
```

#### Defined in

[wslManager.ts:287](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L287)

___

### getDistributionInfo

▸ **getDistributionInfo**(`name`): `Promise`\<`any`\>

Gets detailed information about a WSL distribution

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | Name of the distribution |

#### Returns

`Promise`\<`any`\>

Object containing distribution information (kernel, OS, memory)

**`Throws`**

When distribution name is invalid

**`Example`**

```typescript
const info = await wslManager.getDistributionInfo('Ubuntu');
console.log(`Kernel: ${info.kernel}, OS: ${info.os}`);
```

#### Defined in

[wslManager.ts:540](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L540)

___

### importDistribution

▸ **importDistribution**(`name`, `tarPath`, `installLocation?`): `Promise`\<`void`\>

Imports a TAR file as a new WSL distribution

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | Name for the imported distribution |
| `tarPath` | `string` | Path to the TAR file to import |
| `installLocation?` | `string` | Optional custom installation directory |

#### Returns

`Promise`\<`void`\>

**`Throws`**

When inputs are invalid or file doesn't exist

**`Throws`**

When distribution already exists or import fails

**`Example`**

```typescript
await wslManager.importDistribution('imported-ubuntu', '/path/to/ubuntu.tar');
```

#### Defined in

[wslManager.ts:210](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L210)

___

### listDistributions

▸ **listDistributions**(): `Promise`\<[`WSLDistribution`](../interfaces/wslManager.WSLDistribution.md)[]\>

Lists all WSL distributions on the system

#### Returns

`Promise`\<[`WSLDistribution`](../interfaces/wslManager.WSLDistribution.md)[]\>

Promise resolving to array of WSL distributions

**`Throws`**

When WSL is not installed

**`Example`**

```typescript
const distributions = await wslManager.listDistributions();
console.log(`Found ${distributions.length} distributions`);
```

#### Defined in

[wslManager.ts:51](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L51)

___

### runCommand

▸ **runCommand**(`distribution`, `command`): `Promise`\<`string`\>

Runs a command inside a WSL distribution

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `distribution` | `string` | Name of the distribution to run the command in |
| `command` | `string` | Command to execute |

#### Returns

`Promise`\<`string`\>

Command output (stdout)

**`Throws`**

When distribution name is invalid

**`Throws`**

For security violations or command failures

**`Example`**

```typescript
const kernelVersion = await wslManager.runCommand('Ubuntu', 'uname -r');
```

#### Defined in

[wslManager.ts:500](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L500)

___

### setDefaultDistribution

▸ **setDefaultDistribution**(`name`): `Promise`\<`void`\>

Sets a distribution as the default WSL distribution

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | Name of the distribution to set as default |

#### Returns

`Promise`\<`void`\>

**`Throws`**

When distribution name is invalid

**`Throws`**

For security violations or operation failures

**`Example`**

```typescript
await wslManager.setDefaultDistribution('Ubuntu-20.04');
```

#### Defined in

[wslManager.ts:430](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L430)

___

### terminateDistribution

▸ **terminateDistribution**(`name`): `Promise`\<`void`\>

Terminates a running WSL distribution

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | Name of the distribution to terminate |

#### Returns

`Promise`\<`void`\>

**`Throws`**

When distribution name is invalid

**`Throws`**

For security violations or operation failures

**`Example`**

```typescript
await wslManager.terminateDistribution('Ubuntu');
```

#### Defined in

[wslManager.ts:394](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L394)

___

### unregisterDistribution

▸ **unregisterDistribution**(`name`): `Promise`\<`void`\>

Unregisters (deletes) a WSL distribution

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | Name of the distribution to delete |

#### Returns

`Promise`\<`void`\>

**`Throws`**

When distribution name is invalid or operation is cancelled

**`Throws`**

For security violations or operation failures

**`Remarks`**

This operation is destructive and requires user confirmation

**`Example`**

```typescript
await wslManager.unregisterDistribution('old-distro');
```

#### Defined in

[wslManager.ts:353](https://github.com/sirfifer/vsc-wsl-manager/blob/5b393991c30596f40151a253bb982478cb9feeb0/src/wslManager.ts#L353)
