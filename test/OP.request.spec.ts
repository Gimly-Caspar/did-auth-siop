import { OP, OPBuilder, RP, SIOP } from '../src/main';
import {
  AuthenticationRequestOpts,
  AuthenticationResponseOpts,
  CredentialFormat,
  PassBy,
  ResponseMode,
  SubjectIdentifierType,
  VerificationMode,
  VerifyAuthenticationRequestOpts,
} from '../src/main/types/SIOP.types';

import { mockedGetEnterpriseAuthToken } from './TestUtils';

const EXAMPLE_REDIRECT_URL = 'https://acme.com/hello';
const EXAMPLE_REFERENCE_URL = 'https://rp.acme.com/siop/jwts';

const HEX_KEY = 'f857544a9d1097e242ff0b287a7e6e90f19cf973efe2317f2a4678739664420f';
const DID = 'did:ethr:0x0106a2e985b1E1De9B5ddb4aF6dC9e928F4e99D0';
const KID = 'did:ethr:0x0106a2e985b1E1De9B5ddb4aF6dC9e928F4e99D0#controller';

describe('OP Builder should', () => {
  it('throw Error when no arguments are passed', async () => {
    expect.assertions(1);
    await expect(() => new OPBuilder().build()).toThrowError(Error);
  });
  it('build an OP when all arguments are set', async () => {
    expect.assertions(1);

    expect(
      OP.builder()
        .addDidMethod('ethr')
        .response(ResponseMode.POST)
        .registrationBy(PassBy.REFERENCE, 'https://registration.here')
        .internalSignature('myprivatekey', 'did:example:123', 'did:example:123#key')
        .withExpiresIn(1000)
        .build()
    ).toBeInstanceOf(OP);
  });
});

describe('OP should', () => {
  const responseOpts: AuthenticationResponseOpts = {
    signatureType: {
      hexPrivateKey: HEX_KEY,
      did: DID,
      kid: KID,
    },
    registration: {
      registrationBy: {
        type: SIOP.PassBy.VALUE,
      },
    },
    responseMode: ResponseMode.POST,
    did: DID,
    expiresIn: 2000,
  };

  const verifyOpts: VerifyAuthenticationRequestOpts = {
    verification: {
      mode: VerificationMode.INTERNAL,
      resolveOpts: {
        didMethods: ['ethr'],
      },
    },
    nonce: 'qBrR7mqnY3Qr49dAZycPF8FzgE83m6H0c2l0bzP4xSg',
  };

  it('throw Error when build from request opts without enough params', async () => {
    expect.assertions(1);
    await expect(() => OP.fromOpts({} as never, {} as never)).toThrowError(Error);
  });

  it('return an OP when all request arguments are set', async () => {
    expect.assertions(1);

    expect(OP.fromOpts(responseOpts, verifyOpts)).toBeInstanceOf(OP);
  });

  it('succeed from request opts when all params are set', async () => {
    const mockEntity = await mockedGetEnterpriseAuthToken('ACME Corp');
    const requestOpts: AuthenticationRequestOpts = {
      redirectUri: EXAMPLE_REDIRECT_URL,
      requestBy: {
        type: SIOP.PassBy.REFERENCE,
        referenceUri: EXAMPLE_REFERENCE_URL,
      },
      signatureType: {
        hexPrivateKey: mockEntity.hexPrivateKey,
        did: mockEntity.did,
        kid: `${mockEntity.did}#controller`,
      },
      registration: {
        didMethodsSupported: ['did:ethr:'],
        subjectIdentifiersSupported: SubjectIdentifierType.DID,
        credentialFormatsSupported: [CredentialFormat.JWT],
        registrationBy: {
          type: SIOP.PassBy.VALUE,
        },
      },
    };

    const requestURI = await RP.fromRequestOpts(requestOpts).createAuthenticationRequest({
      nonce: 'qBrR7mqnY3Qr49dAZycPF8FzgE83m6H0c2l0bzP4xSg',
      state: 'b32f0087fc9816eb813fd11f',
    });

    const verifiedRequest = await OP.fromOpts(responseOpts, verifyOpts).verifyAuthenticationRequest(requestURI.jwt);
    console.log(JSON.stringify(verifiedRequest));
    expect(verifiedRequest.issuer).toMatch(mockEntity.did);
    expect(verifiedRequest.signer).toMatchObject({
      id: `${mockEntity.did}#controller`,
      type: 'EcdsaSecp256k1RecoveryMethod2020',
      controller: `${mockEntity.did}`,
    });
    expect(verifiedRequest.jwt).toBeDefined();
  });

  it('succeed from builder when all params are set', async () => {
    const rpMockEntity = await mockedGetEnterpriseAuthToken('ACME RP');
    const opMockEntity = await mockedGetEnterpriseAuthToken('ACME OP');

    const requestURI = await RP.builder()
      .redirect(EXAMPLE_REFERENCE_URL)
      .requestBy(PassBy.REFERENCE, EXAMPLE_REFERENCE_URL)
      .internalSignature(rpMockEntity.hexPrivateKey, rpMockEntity.did, `${rpMockEntity.did}#controller`)
      .addDidMethod('ethr')
      .registrationBy(PassBy.VALUE)
      .build()

      .createAuthenticationRequest({
        nonce: 'qBrR7mqnY3Qr49dAZycPF8FzgE83m6H0c2l0bzP4xSg',
        state: 'b32f0087fc9816eb813fd11f',
      });

    const verifiedRequest = await OP.builder()
      .withExpiresIn(1000)
      .addDidMethod('ethr')
      .internalSignature(opMockEntity.hexPrivateKey, opMockEntity.did, `${opMockEntity.did}#controller`)
      .registrationBy(PassBy.VALUE)
      .build()

      .verifyAuthenticationRequest(requestURI.jwt);
    console.log(JSON.stringify(verifiedRequest));
    expect(verifiedRequest.issuer).toMatch(rpMockEntity.did);
    expect(verifiedRequest.signer).toMatchObject({
      id: `${rpMockEntity.did}#controller`,
      type: 'EcdsaSecp256k1RecoveryMethod2020',
      controller: `${rpMockEntity.did}`,
    });
    expect(verifiedRequest.jwt).toBeDefined();
  });
});
