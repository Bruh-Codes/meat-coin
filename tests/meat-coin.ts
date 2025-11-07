import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MeatCoin } from "../target/types/meat_coin";
import {
  getOrCreateAssociatedTokenAccount,
  createMint,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("meat-coin", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();

  const program = anchor.workspace.MeatCoin as Program<MeatCoin>;

  const admin = anchor.web3.Keypair.generate();
  const [state] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );
  let mint: anchor.web3.PublicKey;
  let treasury: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to the admin account
    await provider.connection.requestAirdrop(
      admin.publicKey,
      100 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise(resolve => setTimeout(resolve, 1000)); // Add a delay

    // Create a new mint
    mint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      9
    );

    // Get the treasury address
    treasury = await getAssociatedTokenAddress(
      mint,
      state,
      true // allowOwnerOffCurve
    );
  });

  it("Is initialized!", async () => {
    await program.methods
      .initialize()
      .accounts({
        mint: mint,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const stateAccount = await program.account.state.fetch(state);
    if (stateAccount.admin.toBase58() !== admin.publicKey.toBase58()) {
      throw new Error("Admin mismatch");
    }
    if (stateAccount.minted.toNumber() !== 0) {
      throw new Error("Minted mismatch");
    }
    if (stateAccount.redeemed.toNumber() !== 0) {
      throw new Error("Redeemed mismatch");
    }
    if (stateAccount.treasury.toBase58() !== treasury.toBase58()) {
      throw new Error("Treasury mismatch");
    }
  });

  it("Mints tokens", async () => {
    const recipient = anchor.web3.Keypair.generate();
    const recipientAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin,
      mint,
      recipient.publicKey
    );

    const amount = new anchor.BN(100);

    await program.methods
      .mint(amount)
      .accounts({
        mint: mint,
        recipient: recipientAccount.address,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const stateAccount = await program.account.state.fetch(state);
    if (stateAccount.minted.toNumber() !== amount.toNumber()) {
      throw new Error("Minted amount mismatch");
    }

    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin,
      mint,
      recipient.publicKey
    );
    if (recipientTokenAccount.amount.toString() !== amount.toString()) {
      throw new Error("Recipient token amount mismatch");
    }
  });

  it("Fails to mint tokens as non-admin", async () => {
    const recipient = anchor.web3.Keypair.generate();
    const recipientAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin,
      mint,
      recipient.publicKey
    );

    const amount = new anchor.BN(100);
    const nonAdmin = anchor.web3.Keypair.generate();

    await provider.connection.requestAirdrop(
      nonAdmin.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );

    try {
      await program.methods
        .mint(amount)
        .accounts({
          mint: mint,
          recipient: recipientAccount.address,
          admin: nonAdmin.publicKey,
        })
        .signers([nonAdmin])
        .rpc();
      throw new Error("Should have failed to mint tokens");
    } catch (err: any) {
      if (err.error.errorMessage !== "Unauthorized: only admin may perform this action") {
        throw new Error("Unexpected error message: " + err.error.errorMessage);
      }
    }
  });

  it("Redeems tokens", async () => {
    const user = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(
      user.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise(resolve => setTimeout(resolve, 1000)); // Add a delay

    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );

    const amount = new anchor.BN(50);
    await program.methods
      .mint(amount)
      .accounts({
        mint: mint,
        recipient: userTokenAccount.address,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const [redemptionRecord] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("redemption"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .redeem(amount)
      .accounts({
        from: userTokenAccount.address,
        treasury: treasury,
        user: user.publicKey,
      })
      .signers([user])
      .rpc();

    const stateAccount = await program.account.state.fetch(state);
    if (stateAccount.redeemed.toNumber() !== amount.toNumber()) {
      throw new Error("Redeemed amount mismatch");
    }

    const userTokenAccountAfter = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );
    if (userTokenAccountAfter.amount.toString() !== "0") {
      throw new Error("User token account amount mismatch after redemption");
    }

    const redemptionRecordAccount = await program.account.redemptionRecord.fetch(
      redemptionRecord
    );
    if (redemptionRecordAccount.user.toBase58() !== user.publicKey.toBase58()) {
      throw new Error("Redemption record user mismatch");
    }
    if (redemptionRecordAccount.amount.toNumber() !== amount.toNumber()) {
      throw new Error("Redemption record amount mismatch");
    }
  });

  it("Changes admin", async () => {
    const newAdmin = anchor.web3.Keypair.generate();
    await program.methods
      .changeAdmin(newAdmin.publicKey)
      .accounts({
        currentAdmin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    const stateAccount = await program.account.state.fetch(state);
    if (stateAccount.admin.toBase58() !== newAdmin.publicKey.toBase58()) {
      throw new Error("Admin change mismatch");
    }
  });

  it("Fails to change admin as non-admin", async () => {
    const newAdmin = anchor.web3.Keypair.generate();
    const nonAdmin = anchor.web3.Keypair.generate();

    await provider.connection.requestAirdrop(
      nonAdmin.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );

    try {
      await program.methods
        .changeAdmin(newAdmin.publicKey)
        .accounts({
          currentAdmin: nonAdmin.publicKey,
        })
        .signers([nonAdmin])
        .rpc();
      throw new Error("Should have failed to change admin");
    } catch (err: any) {
      if (err.error.errorMessage !== "Unauthorized: only admin may perform this action") {
        throw new Error("Unexpected error message: " + err.error.errorMessage);
      }
    }
  });
});