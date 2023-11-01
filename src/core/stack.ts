import { kebabCase } from 'lodash'
import type { AppConfig } from 'cdktf'
import { TerraformStack, App as TerraformApp } from 'cdktf'

export class Stack {
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
   * @var {string} name the stack's name
   */
  readonly name: string

  /**
   * @constructor
   * @param {String} name the stack's name
   * @param {AppConfig} options the terraform app options
   */
  constructor(name: string, options?: AppConfig) {
    this.name = kebabCase(name.toLowerCase())
    this.app = new TerraformApp(options)
    this.context = new TerraformStack(this.app, this.name)
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
