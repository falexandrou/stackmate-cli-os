export type TestConfig = {
  region: string
  bucket: string
  lock: string
  key: string
}

/**
 * WARNING: The bucket and lock table should already be available when running the end to end tests
 *
 * The reasoning for this is that if we use `terraform test` to create the bucket,
 * we would need to wait for a few seconds until the bucket becomes available, so we're going
 * with a pre-provisioned bucket to make tests run faster
 *
 * @param {String} testCase the name of the test case
 * @returns {Object} the setup to use
 */
export const getAwsTestsConfig = (testCase: string): TestConfig => ({
  region: 'eu-central-1',
  bucket: 'stackmate-e2e-tests',
  lock: 'stackmate-terraform-state-lock',
  key: `${testCase}/state-${Date.now()}.tfstate`,
})
