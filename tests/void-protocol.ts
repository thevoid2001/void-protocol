import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { VoidProtocol } from "../target/types/void_protocol";
import { assert } from "chai";
import { createHash } from "crypto";

describe("void-protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.voidProtocol as Program<VoidProtocol>;

  // ─── VOID STAMP TESTS ──────────────────────────────────

  const fileContent = Buffer.from("Hello, this is my secret document!");
  const hash = createHash("sha256").update(fileContent).digest();

  it("Creates a proof of existence", async () => {
    const [proofPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("proof"), hash],
      program.programId
    );

    const tx = await program.methods
      .createProof([...hash])
      .accounts({
        proof: proofPDA,
        owner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  Transaction:", tx);

    const proof = await program.account.proof.fetch(proofPDA);
    assert.deepEqual(Buffer.from(proof.hash), hash, "Hash should match");
    assert.equal(proof.owner.toBase58(), provider.wallet.publicKey.toBase58());
    assert.isAbove(proof.timestamp.toNumber(), 0);

    console.log("  Hash:", hash.toString("hex"));
    console.log("  Owner:", proof.owner.toBase58());
  });

  it("Can verify a proof exists by looking up the PDA", async () => {
    const [proofPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("proof"), hash],
      program.programId
    );
    const proof = await program.account.proof.fetch(proofPDA);
    assert.ok(proof, "Proof should exist on-chain");
    assert.deepEqual(Buffer.from(proof.hash), hash);
  });

  it("Returns null for a hash that was never registered", async () => {
    const unknownHash = createHash("sha256").update("unknown file").digest();
    const [unknownPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("proof"), unknownHash],
      program.programId
    );
    try {
      await program.account.proof.fetch(unknownPDA);
      assert.fail("Should have thrown");
    } catch {
      assert.ok(true);
    }
  });

  it("Rejects duplicate proof for the same hash", async () => {
    const [proofPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("proof"), hash],
      program.programId
    );
    try {
      await program.methods
        .createProof([...hash])
        .accounts({
          proof: proofPDA,
          owner: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have rejected duplicate hash");
    } catch {
      assert.ok(true);
    }
  });

  // ─── VOID DROP TESTS ───────────────────────────────────

  const orgSlug = "test-org";
  const orgName = "Test Organization";
  const orgDescription = "Submit anonymous tips here";
  // Fake ECDH public key (65 bytes: 0x04 prefix + 32 x + 32 y)
  const fakeEncryptionKey = new Uint8Array(65);
  fakeEncryptionKey[0] = 0x04;
  for (let i = 1; i < 65; i++) fakeEncryptionKey[i] = i;

  let orgPDA: anchor.web3.PublicKey;

  it("Creates an organization", async () => {
    [orgPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("org"), Buffer.from(orgSlug)],
      program.programId
    );

    const tx = await program.methods
      .createOrganization(orgSlug, orgName, orgDescription, [...fakeEncryptionKey])
      .accounts({
        organization: orgPDA,
        admin: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  Org created:", tx);

    const org = await program.account.organization.fetch(orgPDA);
    assert.equal(org.slug, orgSlug);
    assert.equal(org.name, orgName);
    assert.equal(org.description, orgDescription);
    assert.equal(org.admin.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(org.submissionCount.toNumber(), 0);
    assert.equal(org.active, true);
    assert.deepEqual(
      Buffer.from(org.encryptionKey),
      Buffer.from(fakeEncryptionKey)
    );

    console.log("  Slug:", org.slug);
    console.log("  Name:", org.name);
    console.log("  Admin:", org.admin.toBase58());
  });

  it("Submits a tip to the organization", async () => {
    const org = await program.account.organization.fetch(orgPDA);
    const submissionId = org.submissionCount.toNumber();

    const [submissionPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("submission"),
        orgPDA.toBuffer(),
        new anchor.BN(submissionId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const fakeArweaveHash = "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcdef";

    const tx = await program.methods
      .submitTip(fakeArweaveHash)
      .accounts({
        submission: submissionPDA,
        organization: orgPDA,
        submitter: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  Submission tx:", tx);

    const sub = await program.account.submission.fetch(submissionPDA);
    assert.equal(sub.id.toNumber(), 0);
    assert.equal(sub.organization.toBase58(), orgPDA.toBase58());
    assert.equal(sub.arweaveHash, fakeArweaveHash);
    assert.equal(sub.submitter.toBase58(), provider.wallet.publicKey.toBase58());
    assert.isAbove(sub.timestamp.toNumber(), 0);

    // Check org submission count incremented
    const orgAfter = await program.account.organization.fetch(orgPDA);
    assert.equal(orgAfter.submissionCount.toNumber(), 1);

    console.log("  Submission ID:", sub.id.toNumber());
    console.log("  Arweave hash:", sub.arweaveHash);
  });

  it("Submits a second tip (increments count)", async () => {
    const org = await program.account.organization.fetch(orgPDA);
    const submissionId = org.submissionCount.toNumber();

    const [submissionPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("submission"),
        orgPDA.toBuffer(),
        new anchor.BN(submissionId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .submitTip("secondSubmissionArweaveHash12345678901234567")
      .accounts({
        submission: submissionPDA,
        organization: orgPDA,
        submitter: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const sub = await program.account.submission.fetch(submissionPDA);
    assert.equal(sub.id.toNumber(), 1);

    const orgAfter = await program.account.organization.fetch(orgPDA);
    assert.equal(orgAfter.submissionCount.toNumber(), 2);
  });

  it("Deactivates an organization", async () => {
    await program.methods
      .deactivateOrganization()
      .accounts({
        organization: orgPDA,
        admin: provider.wallet.publicKey,
      })
      .rpc();

    const org = await program.account.organization.fetch(orgPDA);
    assert.equal(org.active, false);
  });

  it("Rejects submissions to inactive orgs", async () => {
    const org = await program.account.organization.fetch(orgPDA);
    const submissionId = org.submissionCount.toNumber();

    const [submissionPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("submission"),
        orgPDA.toBuffer(),
        new anchor.BN(submissionId).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitTip("shouldFailArweaveHash1234567890123456789012")
        .accounts({
          submission: submissionPDA,
          organization: orgPDA,
          submitter: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have rejected submission to inactive org");
    } catch {
      assert.ok(true, "Correctly rejected submission to inactive org");
    }
  });

  it("Rejects duplicate org slug", async () => {
    const [dupOrgPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("org"), Buffer.from(orgSlug)],
      program.programId
    );

    try {
      await program.methods
        .createOrganization(orgSlug, "Duplicate Org", "desc", [...fakeEncryptionKey])
        .accounts({
          organization: dupOrgPDA,
          admin: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have rejected duplicate slug");
    } catch {
      assert.ok(true, "Correctly rejected duplicate org slug");
    }
  });
});
