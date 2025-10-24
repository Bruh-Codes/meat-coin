# MeatCoin: The Token for Farm Animal Goods & Services

## Project Overview

MeatCoin is a custom SPL (Solana Program Library) token designed to facilitate transactions for goods and services related to farm animals, such as meat products. This project provides a robust and secure on-chain mechanism for managing the token lifecycle, including minting new tokens and enabling transfers to users.

## Key Features

The MeatCoin program, built on the Solana blockchain using the Anchor framework, offers the following core functionalities:

*   **Token Initialization:** Securely sets up the initial state of the MeatCoin program, defining the administrative authority and the treasury account for token management.
*   **Admin-Controlled Minting:** Allows a designated administrator to mint new MeatCoin tokens and distribute them to specified user accounts. This ensures controlled supply and distribution.
*   **User Redemption Mechanism:** Provides a secure way for users to redeem their MeatCoin tokens, transferring them to a central treasury account. This function also tracks individual user redemption history.
*   **Administrator Transfer:** Enables the current administrator to securely transfer administrative control of the MeatCoin program to a new public key.

## Production Readiness for Client Use

MeatCoin has undergone comprehensive unit testing, covering all its core functionalities including initialization, minting, redemption, and admin changes. These tests ensure the program behaves as expected under various scenarios, including unauthorized access attempts.

While the token's smart contract logic is thoroughly tested and deemed stable for its intended use, "production readiness" in a broader sense (e.g., external security audits, formal economic modeling, or large-scale user adoption infrastructure) would depend on further client-specific requirements and external assessments. For the immediate client needs of minting and sending to users, the core program is robust.

## Getting Started (Local Development)

To set up and interact with the MeatCoin project locally, follow these steps:

1.  **Prerequisites:**
    *   Install [Node.js](https://nodejs.org/) (LTS recommended)
    *   Install [Yarn](https://yarnpkg.com/)
    *   Install [Rust](https://www.rust-lang.org/tools/install) and `rustup`
    *   Install [Solana Tool Suite](https://docs.solana.com/cli/install-solana-cli)
    *   Install [Anchor CLI](https://www.anchor-lang.com/docs/installation)

2.  **Clone the repository:**
    ```bash
    git clone [YOUR_REPOSITORY_URL]
    cd meat-coin
    ```

3.  **Install dependencies:**
    ```bash
    yarn install
    ```

4.  **Build the program:**
    ```bash
    anchor build
    ```

5.  **Deploy to a local validator (optional, for testing):**
    ```bash
    solana-test-validator
    # In a new terminal:
    anchor deploy
    ```

## Deployment Information

*   **Program ID:** `92vGubKf8dDMF99AnQ4eLbaByujKBSyCAQ6WwDgt7P6k` (This is the ID from your `lib.rs` and `Anchor.toml`)
*   **Mint Address:** (This will be generated upon initialization of the token. You will need to obtain this after deploying and initializing the program.)

## Usage and Interaction

Interaction with the MeatCoin program can be done via:

*   **Anchor TypeScript Client:** The `tests/meat-coin.ts` file provides examples of how to interact with all program instructions using the Anchor TypeScript client.
*   **Solana CLI:** For basic SPL token operations (like transferring tokens between accounts), the Solana CLI can be used.

## Testing

To run the comprehensive test suite for the MeatCoin program:

```bash
anchor test
```

This will execute all tests located in the `tests/` directory, ensuring the program's logic functions as intended.
