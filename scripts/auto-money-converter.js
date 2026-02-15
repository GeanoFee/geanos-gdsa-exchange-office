/**
 * Geano's GDSA Exchange Office
 * Automatische Umrechnung von Münzen für das goodys dsa4.1 core System
 */

const { DialogV2 } = foundry.applications.api;

class DSAMoneyConverter {
  static CONVERSION_RATES = {
    nickel: 1,      // Kreuzer (Basiseinheit)
    copper: 10,     // Heller
    silver: 100,    // Silber
    gold: 1000      // Dukaten
  };

  static ID = "geanos-gdsa-exchange-office";

  // Debounce Timer für jeden Actor
  static updateTimers = new Map();

  /**
   * Konvertiert alle Münzen in die kleinstmögliche Einheit (Kreuzer/Nickel)
   * @param {object} money - Das Geld-Objekt aus dem Actor System
   * @returns {number} Gesamtwert in Kreuzern
   */
  static toBaseUnit(money) {
    return (money.gold || 0) * this.CONVERSION_RATES.gold +
      (money.silver || 0) * this.CONVERSION_RATES.silver +
      (money.copper || 0) * this.CONVERSION_RATES.copper +
      (money.nickel || 0) * this.CONVERSION_RATES.nickel;
  }

  /**
   * Konvertiert Kreuzer zurück in die größtmöglichen Münzeinheiten
   * @param {number} totalNickel - Gesamtwert in Kreuzern
   * @returns {object} Optimiertes Geld-Objekt
   */
  static fromBaseUnit(totalNickel) {
    let remaining = totalNickel;

    const gold = Math.floor(remaining / this.CONVERSION_RATES.gold);
    remaining = remaining % this.CONVERSION_RATES.gold;

    const silver = Math.floor(remaining / this.CONVERSION_RATES.silver);
    remaining = remaining % this.CONVERSION_RATES.silver;

    const copper = Math.floor(remaining / this.CONVERSION_RATES.copper);
    remaining = remaining % this.CONVERSION_RATES.copper;

    const nickel = remaining;

    return { gold, silver, copper, nickel };
  }

  /**
   * Optimiert die Münzverteilung eines Charakters
   * @param {object} money - Das Geld-Objekt
   * @returns {object} Optimiertes Geld-Objekt
   */
  static optimizeMoney(money) {
    const totalNickel = this.toBaseUnit(money);
    return this.fromBaseUnit(totalNickel);
  }

  /**
   * Prüft ob eine Umrechnung notwendig ist
   * @param {object} money - Das Geld-Objekt
   * @returns {boolean}
   */
  static needsOptimization(money) {
    const current = {
      gold: money.gold || 0,
      silver: money.silver || 0,
      copper: money.copper || 0,
      nickel: money.nickel || 0
    };

    // Wenn eine der kleineren Einheiten >= 10 ist (oder < 0)
    if (current.nickel >= 10 || current.copper >= 10 || current.silver >= 10) return true;
    if (current.nickel < 0 || current.copper < 0 || current.silver < 0 || current.gold < 0) return true;

    return false;
  }

  /**
   * Wartet auf alle Updates und führt dann die Umrechnung durch
   * @param {string} actorId 
   */
  static scheduleConversion(actorId) {
    if (this.updateTimers.has(actorId)) {
      clearTimeout(this.updateTimers.get(actorId));
    }

    const timer = setTimeout(() => {
      this.performConversion(actorId);
    }, 100);

    this.updateTimers.set(actorId, timer);
  }

  /**
   * Führt die eigentliche Umrechnung durch
   * @param {string} actorId 
   * @param {boolean} [manual=false] - Ob dies manuell ausgelöst wurde
   */
  static async performConversion(actorId, manual = false) {
    this.updateTimers.delete(actorId);

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const currentMoney = actor.system.money;

    // Bei manuellem Trigger immer optimieren, sonst nur wenn nötig
    if (!manual && !this.needsOptimization(currentMoney)) {
      return;
    }

    const optimized = this.optimizeMoney(currentMoney);
    const total = this.toBaseUnit(optimized);

    // Negative Funds Check
    if (total < 0) {
      if (game.settings.get(this.ID, "showNotifications") || manual) {
        ui.notifications.warn(game.i18n.localize("DSA_MONEY.InsufficientFunds"));
      }
      await actor.update({ "system.money": { gold: 0, silver: 0, copper: 0, nickel: 0 } }, { gdsa_autoconvert: true });
      return;
    }

    // Update durchführen
    if (manual || optimized.gold !== currentMoney.gold || optimized.silver !== currentMoney.silver ||
      optimized.copper !== currentMoney.copper || optimized.nickel !== currentMoney.nickel) {

      await actor.update({ "system.money": optimized }, { gdsa_autoconvert: true });

      if (game.settings.get(this.ID, "showNotifications") || manual) {
        ui.notifications.info(
          game.i18n.format("DSA_MONEY.OptimizedNotification", {
            name: actor.name,
            gold: optimized.gold,
            silver: optimized.silver,
            copper: optimized.copper,
            nickel: optimized.nickel
          })
        );
      }
    } else if (manual) {
      ui.notifications.info(game.i18n.localize("DSA_MONEY.AlreadyOptimized"));
    }
  }

  /**
   * ApplicationV2: Manueller Dialog
   */
  static async promptManualExchange(actor) {
    const confirmed = await DialogV2.confirm({
      window: { title: "Wechselstube" },
      content: `<p>${game.i18n.format("DSA_MONEY.ConfirmExchange", { name: actor.name })}</p>`,
      modal: true
    });

    if (confirmed) {
      await this.performConversion(actor.id, true);
    }
  }
}

// Hook für Actor-Updates
Hooks.on("updateActor", (actor, updateData, options, userId) => {
  if (options.gdsa_autoconvert) return;
  if (actor.type !== "PlayerCharakter" || game.system.id !== "gdsa") return;
  if (!foundry.utils.hasProperty(updateData, "system.money")) return;

  DSAMoneyConverter.scheduleConversion(actor.id);
});

// Header Button für manuellen Exchange
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (sheet.actor.type !== "PlayerCharakter") return;

  buttons.unshift({
    label: "Geld wecheln",
    class: "exchange-money",
    icon: "fas fa-coins",
    onclick: () => DSAMoneyConverter.promptManualExchange(sheet.actor)
  });
});

// Modul-Initialisierung
Hooks.once("init", () => {
  console.log("Geano's GDSA Exchange Office | Initializing");

  game.settings.register(DSAMoneyConverter.ID, "showNotifications", {
    name: game.i18n.localize("DSA_MONEY.ShowNotifications"),
    hint: game.i18n.localize("DSA_MONEY.ShowNotificationsHint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(DSAMoneyConverter.ID, "welcomeShown", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
});

Hooks.once("ready", () => {
  if (game.user.isGM && !game.settings.get(DSAMoneyConverter.ID, "welcomeShown")) {
    ui.notifications.info("Geano's GDSA Exchange Office aktiviert! Münzen werden jetzt automatisch umgerechnet.");
    game.settings.set(DSAMoneyConverter.ID, "welcomeShown", true);
  }
});