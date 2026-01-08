/**
 * Geano's GDSA Exchange Office
 * Automatische Umrechnung von Münzen für das goodys dsa4.1 core System
 * 
 * Umrechnungsfaktoren:
 * 10 Nickel (Kreuzer) = 1 Copper (Heller)
 * 10 Copper (Heller) = 1 Silver (Silber)
 * 10 Silver (Silber) = 1 Gold (Dukaten)
 */

class DSAMoneyConverter {
  static CONVERSION_RATES = {
    nickel: 1,      // Kreuzer (Basiseinheit)
    copper: 10,     // Heller
    silver: 100,    // Silber
    gold: 1000      // Dukaten
  };

  // Debounce Timer für jeden Actor
  static updateTimers = new Map();

  /**
   * Konvertiert alle Münzen in die kleinstmögliche Einheit (Kreuzer/Nickel)
   */
  static toBaseUnit(money) {
    return (money.gold || 0) * this.CONVERSION_RATES.gold +
           (money.silver || 0) * this.CONVERSION_RATES.silver +
           (money.copper || 0) * this.CONVERSION_RATES.copper +
           (money.nickel || 0) * this.CONVERSION_RATES.nickel;
  }

  /**
   * Konvertiert Kreuzer zurück in die größtmöglichen Münzeinheiten
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
   */
  static optimizeMoney(money) {
    const totalNickel = this.toBaseUnit(money);
    return this.fromBaseUnit(totalNickel);
  }

  /**
   * Prüft ob eine Umrechnung notwendig ist
   */
  static needsOptimization(money) {
    const current = {
      gold: money.gold || 0,
      silver: money.silver || 0,
      copper: money.copper || 0,
      nickel: money.nickel || 0
    };
    
    // Wenn eine der kleineren Einheiten >= 10 ist, sollte umgerechnet werden
    if (current.nickel >= 10 || current.copper >= 10 || current.silver >= 10) {
      return true;
    }
    
    // Prüfe ob negative Werte existieren (beim Ausgeben)
    if (current.nickel < 0 || current.copper < 0 || current.silver < 0 || current.gold < 0) {
      return true;
    }
    
    return false;
  }

  /**
   * Wartet auf alle Updates und führt dann die Umrechnung durch
   */
  static scheduleConversion(actorId) {
    // Lösche vorheriges Timeout
    if (this.updateTimers.has(actorId)) {
      clearTimeout(this.updateTimers.get(actorId));
    }

    // Warte 100ms auf weitere Updates, dann rechne um
    const timer = setTimeout(() => {
      this.performConversion(actorId);
    }, 100);

    this.updateTimers.set(actorId, timer);
  }

  /**
   * Führt die eigentliche Umrechnung durch
   */
  static async performConversion(actorId) {
    this.updateTimers.delete(actorId);

    const actor = game.actors.get(actorId);
    if (!actor) return;

    // Hole die AKTUELLEN Geldwerte aus dem Actor
    const currentMoney = actor.system.money;

    // Prüfe ob Umrechnung nötig ist
    if (!this.needsOptimization(currentMoney)) {
      return;
    }

    const optimized = this.optimizeMoney(currentMoney);
    const total = this.toBaseUnit(optimized);

    // Wenn das Gesamtgeld negativ ist, zeige Warnung
    if (total < 0) {
      if (game.settings.get("geanos-gdsa-exchange-office", "showNotifications")) {
        ui.notifications.warn(
          game.i18n.localize("DSA_MONEY.InsufficientFunds")
        );
      }
      // Setze Geld auf 0
      await actor.update({
        "system.money": { gold: 0, silver: 0, copper: 0, nickel: 0 }
      }, { gdsa_autoconvert: true });
      return;
    }

    // Update nur wenn sich was geändert hat
    if (optimized.gold !== currentMoney.gold || 
        optimized.silver !== currentMoney.silver ||
        optimized.copper !== currentMoney.copper ||
        optimized.nickel !== currentMoney.nickel) {
      
      await actor.update({
        "system.money": optimized
      }, { gdsa_autoconvert: true });

      // Zeige Benachrichtigung
      if (game.settings.get("geanos-gdsa-exchange-office", "showNotifications")) {
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
    }
  }
}

// Hook für Actor-Updates
Hooks.on("updateActor", (actor, updateData, options, userId) => {
  // Verhindere Endlosschleife
  if (options.gdsa_autoconvert) {
    return;
  }

  // Nur für Charaktere mit dem DSA-System
  if (actor.type !== "PlayerCharakter" || game.system.id !== "gdsa") {
    return;
  }

  // Prüfe ob Geld-Daten geändert wurden
  if (!updateData.system?.money) {
    return;
  }

  // Schedule eine verzögerte Umrechnung (wartet auf alle 4 Updates)
  DSAMoneyConverter.scheduleConversion(actor.id);
});

// Modul-Initialisierung
Hooks.once("init", () => {
  console.log("Geano's GDSA Exchange Office | Initialisiere Modul");

  // Registriere Modul-Einstellungen
  game.settings.register("geanos-gdsa-exchange-office", "showNotifications", {
    name: game.i18n.localize("DSA_MONEY.ShowNotifications"),
    hint: game.i18n.localize("DSA_MONEY.ShowNotificationsHint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  console.log("Geano's GDSA Exchange Office | Modul bereit");
  
  // Zeige Willkommensnachricht nur beim ersten Start
  if (game.user.isGM && !game.settings.get("geanos-gdsa-exchange-office", "welcomeShown")) {
    ui.notifications.info("Geano's GDSA Exchange Office aktiviert! Münzen werden jetzt automatisch umgerechnet.");
    game.settings.register("geanos-gdsa-exchange-office", "welcomeShown", {
      scope: "world",
      config: false,
      type: Boolean,
      default: true
    });
  }
});