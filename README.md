# Geano's GDSA Exchange Office

A currency management utility for the "goodys dsa4.1 core" system (gdsa) in FoundryVTT. It automatically optimizes and converts coin values for characters, ensuring their purse is always organized.

## 🌟 Features

- **Automatic Coin Conversion**: Whenever a character's money is updated, the module automatically reorganizes it into the highest possible coin denominations.
  - *Conversion Rates*:
    - 1 Dukaten (Gold) = 10 Silber
    - 1 Silber = 10 Heller (Copper)
    - 1 Heller = 10 Kreuzer (Nickel)
- **Mathematical Inputs**: Allows users to input values like `+5` or `-20` in the character sheet (handled by standard Foundry/System behavior), and the module will clean up the result.
- **Debounced Updates**: Intelligently waits for multiple rapid updates to finish before optimizing, preventing calculation errors.
- **Insufficient Funds Warning**: Warns if a transaction would result in negative money and prevents it.

## 🎮 Usage

Simply install and enable the module. It works automatically in the background for all Actors of type "PlayerCharakter" within the `gdsa` system.

## Settings

- **Show Notifications**: Toggle to enable/disable the "Money Optimized" pop-up messages.

## 🚀 Installation

- **Manifest URL**: `https://github.com/GeanoFee/geanos-gdsa-exchange-office/releases/latest/download/module.json`

