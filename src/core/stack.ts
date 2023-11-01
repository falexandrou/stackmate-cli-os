import type { AppConfig } from 'cdktf'
import { TerraformStack, App as TerraformApp } from 'cdktf'

/**
 * @type {Stack} the stage's stack
 */
export type Stack = {
  readonly app: TerraformApp
  readonly context: TerraformStack
  readonly projectName: string
  readonly stageName: string
  toObject(): object
  toJson(): string
}

export class StageStack implements Stack {
  /**
   * @var {TerraformApp} app the terraform app for synthesizing the stack
   * @readonly
   */
  readonly app: TerraformApp

  /**
   * @var {TerraformStack} context the terraform stack object for synthesizing the stack
   * @readonly
   */
  readonly context: TerraformStack

  /**
   * @var {String} projectName the project's name
   * @readonly
   */
  readonly projectName: string

  /**
   * @var {String} stageName the stage's name
   * @readonly
   */
  readonly stageName: string

  /**
   * @constructor
   * @param {String} projectName the project's name
   * @param {String} stageName the stage's name
   * @param {AppConfig} options the terraform app options
   */
  constructor(projectName: string, stageName: string, options?: AppConfig) {
    this.projectName = projectName
    this.stageName = stageName
    this.app = new TerraformApp(options)
    this.context = new TerraformStack(this.app, `${this.projectName}-${this.stageName}`)
  }

  /**
   * @returns {Object} the stack exported as terraform json object
   */
  toObject(): object {
    return this.context.toTerraform()
  }

  /**
   * @returns {String} the JSON representation of the stack
   */
  toJson(): string {
    return JSON.stringify(this.toObject(), null, 2)
  }
}

/**
 * Returns a stack object to be used for stage composition
 *
 * @param {String} projectName the project's name
 * @param {String} stageName the stage's name
 * @param {AppConfig} options the terraform app options
 * @returns {Stack} the stack object
 */
export const getStack = (projectName: string, stageName: string, options?: AppConfig): Stack =>
  new StageStack(projectName, stageName, options)