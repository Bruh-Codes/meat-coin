// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MeatCoin } from "../target/types/meat_coin";

module.exports = async function (provider: anchor.AnchorProvider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  // Add your deploy script here.
  const program = anchor.workspace.MeatCoin as Program<MeatCoin>;
  const state = anchor.web3.Keypair.generate();
  const treasury = anchor.web3.Keypair.generate();

  // Initialize the program
  await program.methods
    .initialize(provider.wallet.publicKey)
    .accounts({
      state: state.publicKey,
      payer: provider.wallet.publicKey,
      treasury: treasury.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([state])
    .rpc();
};
