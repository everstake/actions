import {
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction,
  StakeProgram,
  Keypair,
  Transaction,
  Authorized,
  ComputeBudgetProgram
} from '@solana/web3.js';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from '../openapi';
import { prepareTransaction } from '../../shared/transaction-utils';
import { ActionGetResponse, ActionPostRequest, ActionPostResponse } from '@solana/actions';
import { connection } from '../../shared/connection';
require('dotenv').config();

const VALIDATOR_ADDRESS = '9QU2QSxhb24FUX3Tu2FpczXjpK3VYrvRudywSZaM29mF';
const VALIDATOR_ADDRESS_DEVNET ='FwR3PbjS5iyqzLiLugrBqKSa5EKZ4vK9SKs7eQXtT59f';
const STAKE_AMOUNT_SOL_OPTIONS = [1, 5, 10];
const DEFAULT_STAKE_AMOUNT_SOL = 1;

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Stake'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {  
    const requestUrl = new URL(c.req.url);
    const { icon, title, description } = getStakeInfo(requestUrl.origin);
    const amountParameterName = 'amount';
    const response: ActionGetResponse = {
      icon,
      label: `${DEFAULT_STAKE_AMOUNT_SOL} SOL`,
      title,
      description,
      links: {
        actions: [
          ...STAKE_AMOUNT_SOL_OPTIONS.map((amount) => ({
            label: `${amount} SOL`,
            href: `/api/everstake/stake/${amount}`,
          })),
          {
            href: `/api/everstake/stake/{${amountParameterName}}`,
            label: 'Stake',
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom SOL amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/{amount}',
    tags: ['Stake'],
    request: {
      params: z.object({
        amount: z.string().openapi({
          param: {
            name: 'amount',
            in: 'path',
          },
          type: 'number',
          example: '1',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const amount = c.req.param('amount');
    const requestUrl = new URL(c.req.url);
    const { icon, title, description } = getStakeInfo(requestUrl.origin);
    const response: ActionGetResponse = {
      icon,
      label: `${amount} SOL`,
      title,
      description,
    };
    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/{amount}',
    tags: ['Stake'],
    request: {
      params: z.object({
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '1',
          }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const amount =
      c.req.param('amount') ?? DEFAULT_STAKE_AMOUNT_SOL.toString();
    const { account } = (await c.req.json()) as ActionPostRequest;

    let validator_address = VALIDATOR_ADDRESS;
    if (process.env.ENVIRONMENT === 'development') {
      validator_address = VALIDATOR_ADDRESS_DEVNET;
    }

    const parsedAmount = parseFloat(amount);
    const transaction = await prepareStakeTransaction(
      new PublicKey(account),
      new PublicKey(validator_address),
      parsedAmount * LAMPORTS_PER_SOL,
    );
    const response: ActionPostResponse = {
      transaction: Buffer.from(transaction.serialize()).toString('base64'),
    };
    return c.json(response, 200);
  },
);

function getStakeInfo(baseURL: string): Pick<
  ActionGetResponse,
  'icon' | 'title' | 'description'
> {
  const icon = new URL("/static/Everstake.png", baseURL).toString();
  const title = 'Stake SOL with Everstake, earn 7% APR';
  const description =
    "Everstake, the biggest staking provider in the blockchain industry, trusted by 735,000+ users!";
  return { icon, title, description };
}

async function prepareStakeTransaction(
  sender: PublicKey,
  validatorVoteAccount: PublicKey,
  lamports: number,
): Promise<VersionedTransaction> {
  const stakeAccount = Keypair.generate();

  // Calculate how much we want to stake
    const minimumRent = await connection.getMinimumBalanceForRentExemption(
      StakeProgram.space,
  )

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: 50}),
    StakeProgram.createAccount({
      authorized: new Authorized(sender, sender),
      fromPubkey: sender,
      lamports: lamports + minimumRent,
      stakePubkey: stakeAccount.publicKey,
    }),
    StakeProgram.delegate({
      stakePubkey: stakeAccount.publicKey,
      authorizedPubkey: sender,
      votePubkey: validatorVoteAccount
    })
  );

  let versionedTX = await prepareTransaction(tx.instructions, sender);
  versionedTX.sign([stakeAccount]);

  return versionedTX;
}

export default app;
