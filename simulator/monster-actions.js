let monsterActions = {
    // R RARITY
    "Axe Beak": {
        "Savage Beak": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1d8 + 2 slashing damage.",
            "function": () => {
                if (confirm("Did this monster move 20 feet before attacking?")) {
                    attack(4, 1, 8, (2 + rollMultiDice(1, 6)), "Axe Beak", "Savage Beak", "slashing");
                } else {
                    attack(4, 1, 8, 2, "Axe Beak", "Savage Beak", "slashing");
                }
            }
        }
    },
    "Blink Dog": {
        "Bite": {
            "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 1d6 + 1 piercing damage.",
            "function": () => { attack(3, 1, 6, 1, "Blink Dog", "Bite", "piercing"); }
        },
        "Blink Strike (1/S)": {
            "once": true,
            "text": "This monster magically teleports up to 40 feet and may immediately make a Bite attack before or after teleporting.",
            "function": () => {
                if (confirm("Make a Bite attack?")) {
                    attack(3, 1, 6, 1, "Blink Dog", "Bite", "piercing");
                }
            }
        }
    },
    "Cockatrice": {
        "Petrifying Peck": {
            "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 1d4 + 1 piercing damage. The target must make a DC 11 CON saving throw or become restrained for 1 turn. If they fail again at the end of their next turn, they are petrified for 1 additional turn.",
            "function": () => {
                attack(3, 1, 4, 1, "Cockatrice", "Petrifying Peck", "piercing").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 11 CON saving throw or become restrained for 1 turn. If they fail again at the end of their next turn, they are petrified for 1 additional turn.");
                    }
                });
            }
        }
    },
    "Cultist": {
        "Zealot's Blade": {
            "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 1d6 + 1 slashing damage.",
            "function": () => {
                // Cult High Priest - Dark Blessing Passive
                let darkBlessing = 0;
                for (c in currentMonsters) {
                    if (currentMonsters[c].name === "Cult High Priest") {
                        darkBlessing = 3;
                        break;
                    }
                }
                attack(3 + darkBlessing, 1, 6, 1, "Cultist", "Zealot's Blade", "slashing");
            }
        }
    },
    "Flame Skull": {
        "Fire Ray": {
            "text": "Ranged Spell Attack: +5 to hit, range 30 ft., one target. Hit: 2d6 fire damage.",
            "function": () => { attack(5, 2, 6, 0, "Flame Skull", "Fire Ray", "fire"); }
        }
    },
    "Gas Spore": {
        "Spore Burst": {
            "text": "Melee Attack: +3 to hit, reach 5 ft., one target. Hit: 1d6 poison damage.",
            "function": () => { attack(3, 1, 6, 0, "Gas Spore", "Spore Burst", "poison"); }
        }
    },
    "Ghoul": {
        "Paralyzing Claws": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 2d4 + 2 slashing damage. The target must make a DC 11 CON saving throw or be paralyzed until the end of its next turn.",
            "function": () => {
                attack(4, 2, 4, 2, "Ghoul", "Paralyzing Claws", "slashing").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 11 CON saving throw or be paralyzed until the end of its next turn.");
                    }
                });
            }
        }
    },
    "Giant Bat": {
        "Bloodletting Bite": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1d6 + 2 piercing damage. If this attack reduces an enemy to half HP or lower, they start bleeding, taking 1d4 extra damage at the start of their next turn.",
            "function": () => { attack(4, 1, 6, 2, "Giant Bat", "Bloodletting Bite", "piercing"); }
        }
    },
    "Gnoll": {
        "Ravenous Claw": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1d6 + 2 slashing damage.",
            "function": () => {
                attack(4, 1, 6, 2, "Gnoll", "Ravenous Claw", "slashing");
                // Gnoll - Rampage Passive
                if (confirm("Did this monster's attack reduce an enemy's HP to 0? Click OK if so.")) {
                    if (confirm("This monster may immediately move up to 10 feet and make a Ravenous Claw attack. Do so?")) {
                        attack(4, 1, 6, 2, "Gnoll", "Ravenous Claw", "slashing");
                    }
                }
            }
        },
        "Hunting Spear": {
            "text": "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 1d8 + 2 piercing damage.",
            "function": () => {
                attack(4, 1, 8, 2, "Gnoll", "Hunting Spear", "piercing");
                // Gnoll - Rampage Passive
                if (confirm("Did this monster's attack reduce an enemy's HP to 0? Click OK if so.")) {
                    if (confirm("This monster may immediately move up to 10 feet and make a Ravenous Claw attack. Do so?")) {
                        attack(4, 1, 6, 2, "Gnoll", "Ravenous Claw", "slashing");
                    }
                }
            }
        }
    },
    "Goblin": {
        "Cutthroat Slash": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1d6 + 2 slashing damage.",
            "function": () => { attack(4, 1, 6, 2, "Goblin", "Cutthroat Slash", "slashing"); }
        },
        "Ranger Shot": {
            "text": "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 1d6 + 2 piercing damage.",
            "function": () => { attack(4, 1, 6, 2, "Goblin", "Ranger Shot", "piercing"); }
        }
    },
    "Mud Mephit": {
        "Muddy Claws": {
            "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 1d6 + 1 slashing damage.",
            "function": () => { attack(3, 1, 6, 1, "Mud Mephit", "Muddy Claws", "slashing"); }
        },
        "Mud Breath (1/S)": {
            "once": true,
            "text": "This monster spits sticky mud at a target within 15 feet. The target must make a DC 11 DEX saving throw or have its movement speed halved until the end of its next turn.",
            "function": () => {
                alert("This monster spits sticky mud at a target within 15 feet. The target must make a DC 11 DEX saving throw or have its movement speed halved until the end of its next turn.");
            }
        }
    },
    "Pixie": {
        "Pixie Dust": {
            "text": "Ranged Magic Attack: +4 to hit, range 15 ft., one target. Hit: 1d4 + 1 force damage, and the target must make a DC 11 CON saving throw or be dazed and lose reactions until the end of its next turn.",
            "function": () => {
                attack(4, 1, 4, 1, "Pixie", "Pixie Dust", "force").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 11 CON saving throw or be dazed and lose reactions until the end of its next turn.");
                    }
                });
            }
        },
        "Fey Trickster (1/S)": {
            "once": true,
            "text": "Choose one enemy. It must make a DC 12 INT saving throw or have disadvantage on its next attack roll.",
            "function": () => {
                alert("Choose one enemy. It must make a DC 12 INT saving throw or have disadvantage on its next attack roll.");
            }
        }
    },
    "Rust Monster": {
        "Antennae Swipe": {
            "text": "Melee Attack: +5 to hit, reach 5 ft., one target. Hit: 1d8 + 2 bludgeoning damage.",
            "function": () => {
                attack(5, 1, 8, 2, "Rust Monster", "Antennae Swipe", "bludgeoning");
                alert("If the target is wearing metal armor or wielding a metal weapon, it must make a DC 12 CON saving throw or have its AC reduced by 1 or its weapon deal -1 damage. This effect is cumulative.");
            }
        }
    },
    "Shadow": {
        "Strength Drain": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 2d6 + 2 necrotic damage, and the target's STR score is reduced by 1d4 for 2 turns.",
            "function": () => {
                attack(4, 2, 6, 2, "Shadow", "Strength Drain", "necrotic").then((hit) => {
                    if (hit) {
                        let strReduc = rollDice(4);
                        setTimeout(() => {
                            alert("The target's STR score is reduced by", strReduc, "for 2 turns.");
                        }, 3000);
                    }
                });
            }
        }
    },
    "Skeleton": {
        "Rusty Shortsword": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1d6 + 2 piercing damage.",
            "function": () => { attack(4, 1, 6, 2, "Skeleton", "Rusty Shortsword", "piercing"); }
        },
        "Fragile Shortbow": {
            "text": "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 1d6 + 2 piercing damage.",
            "function": () => { attack(4, 1, 6, 2, "Skeleton", "Fragile Shortbow", "piercing"); }
        }
    },
    "Smoke Mephit": {
        "Ashen Claws": {
            "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 1d6 + 1 slashing damage.",
            "function": () => { attack(3, 1, 6, 1, "Smoke Mephit", "Ashen Claws", "slashing"); }
        },
        "Cinder Breath (1/S)": {
            "once": true,
            "text": "This monster exhales a 15-foot cone of smoldering ash. Creatures in the area must make a DC 11 DEX saving throw or take 1d6 fire damage and have disadvantage on their next attack roll.",
            "function": () => {
                alert("This monster exhales a 15-foot cone of smoldering ash. Creatures in the area must make a DC 11 DEX saving throw or take 1d6 fire damage and have disadvantage on their next attack roll.");
                if (confirm("Deal damage?")) {
                    let dmg = rollMultiDice(1, 6);
                    alert(`Smoke Mephit's Cinder Breath deals ${dmg} fire damage!`);
                }
            }
        }
    },
    "Swarm of Insects": {
        "Biting Horde": {
            "text": "Melee Weapon Attack: +3 to hit, reach 0 ft., one target in the swarm's space. Hit: 4d6 piercing damage.",
            "function": () => { attack(3, 4, 6, 0, "Swarm of Insects", "Biting Horde", "piercing"); }
        },
    },
    "Tridrone": {
        "Spear Assault": {
            "text": "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 1d6 + 2 piercing damage.",
            "function": () => { attack(4, 1, 6, 2, "Tridrone", "Spear Assault", "piercing"); }
        }
    },
    "Wolf": {
        "Rending Bite": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 2d4 + 2 piercing damage. If the target is a creature, it must succeed on a DC 11 STR saving throw or be knocked prone.",
            "function": () => {
                attack(4, 2, 4, 2, "Wolf", "Rending Bite", "piercing").then((hit) => {
                    if (hit) {
                        alert("The target must succeed on a DC 11 STR saving throw or be knocked prone.");
                    }
                });
            }
        }
    },
    "Zombie": {
        "Rotting Slam": {
            "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 1d6 + 1 bludgeoning damage. If the target is paralyzed, this attack deals an extra 1d6 necrotic damage.",
            "function": () => {
                attack(3, 1, 6, 1, "Zombie", "Rotting Slam", "bludgeoning");
                if (confirm("Is the target paralyzed?")) {
                    let addDmg = rollMultiDice(1, 6);
                    alert(`Zombie's Rotting Slam deals an additional ${addDmg} necrotic damage!`);
                }
            }
        }
    },
    // SR RARITY
    "Animated Armor": {
        "Heavy Slam": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d6 + 3 bludgeoning damage.",
            "function": () => { attack(6, 2, 6, 3, "Animated Armor", "Heavy Slam", "bludgeoning"); }
        }
    },
    "Ankheg": {
        "Bite & Crush": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d6 + 4 piercing damage. The target must make a DC 12 STR saving throw or be grappled.",
            "function": () => {
                attack(6, 2, 6, 4, "Ankheg", "Bite & Crush", "piercing").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 12 STR saving throw or be grappled.");
                    }
                });
            }
        },
        "Acid Spray (1/S)": {
            "once": true,
            "text": "This monster spits acid in a 15 foot line, provided that it has no creature grappled. Each creature in the area must make a DC 13 DEX saving throw, taking 3d6 acid damage on a failed save, or half as much damage on a successful one.",
            "function": () => {
                alert("This monster spits acid in a 15 foot line, provided that it has no creature grappled. Each creature in the area must make a DC 13 DEX saving throw, taking 3d6 acid damage on a failed save, or half as much damage on a successful one.");
                let dmg = rollMultiDice(3, 6);
                alert(`Ankheg's Acid Spray deals ${dmg} acid damage against failed saves, and ${Math.floor(dmg / 2)} acid damage against successful saves!`);
            }
        }
    },
    "Banshee": {
        "Corrupting Touch": {
            "text": "Melee Spell Attack: +6 to hit, reach 5 ft., one target. Hit: 3d6 necrotic damage.",
            "function": () => { attack(6, 3, 6, 0, "Banshee", "Corrupting Touch", "necrotic"); }
        },
        "Wail of the Dead (1/S)": {
            "once": true,
            "text": "All non-Undead creatures within 10 feet must make a DC 14 CON saving throw. On a failure, they take 4d6 necrotic damage and are frightened until the end of their next turn. On a success, they take half as much damage and are not frightened.",
            "function": () => {
                alert("All non-Undead creatures within 10 feet must make a DC 14 CON saving throw. On a failure, they take 4d6 necrotic damage and are frightened until the end of their next turn. On a success, they take half as much damage and are not frightened.");
                let dmg = rollMultiDice(4, 6);
                alert(`Banshee's Wail of the Dead deals ${dmg} necrotic damage against failed saves, and ${Math.floor(dmg / 2)} necrotic damage against successful saves!`);
            }
        }
    },
    "Blue Dragon Wyrmling": {
        "Bite of the Storm": {
            "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1d10 + 3 piercing damage plus 1d6 lightning damage.",
            "function": () => {
                attack(6, 2, 6, 4, "Blue Dragon Wyrmling", "Bite of the Storm", "piercing").then((hit) => {
                    if (hit) {
                        let extraDmg = rollDiceNoAnim(6);
                        alert("The target also receives", extraDmg, "lightning damage.");
                    }
                });
            }
        },
        "Lightning Breath (1/S)": {
            "once": true,
            "text": "This monster exhales lightning in a 20-foot line. Each creature in that line must make a DC 13 DEX saving throw, taking 4d6 lightning damage on a failed save, or half as much damage on a successful one.",
            "function": () => {
                alert("This monster exhales lightning in a 20-foot line. Each creature in that line must make a DC 13 DEX saving throw, taking 4d6 lightning damage on a failed save, or half as much damage on a successful one.");
                let dmg = rollMultiDice(4, 6);
                alert(`Blue Dragon Wyrmling's Lightning Breath deals ${dmg} lightning damage against failed saves, and ${Math.floor(dmg / 2)} lightning damage against successful saves!`);
            }
        }
    },
    "Bulette": {
        "Rending Bite": {
            "text": "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 2d8 + 4 piercing damage.",
            "function": () => {
                // Bulette - Burrowing Terror Passive
                if (confirm("Did this monster move at least 15 feet underground before attacking?")) {
                    attack(7, 2, 8, (4 + rollMultiDice(1, 8)), "Bulette", "Rending Bite", "piercing");
                } else {
                    attack(7, 2, 8, 4, "Bulette", "Rending Bite", "piercing");
                }
            }
        },
        "Deadly Leap (1/S)": {
            "once": true,
            "text": "This monster leaps up to 20 feet and crashes down in a 10-foot radius. All creatures in the area must make a DC 14 DEX saving throw or take 3d6 bludgeoning damage and be knocked prone. On a successful save, the creature takes half the damage and is instead pushed 5 feet out of this monster's space.",
            "function": () => {
                alert("This monster leaps up to 20 feet and crashes down in a 10-foot radius. All creatures in the area must make a DC 14 DEX saving throw or take 3d6 bludgeoning damage and be knocked prone. On a successful save, the creature takes half the damage and is instead pushed 5 feet out of this monster's space.");
                let dmg = rollMultiDice(3, 6);
                alert(`Bulette's Deadly Leap deals ${dmg} bludgeoning damage against failed saves, and ${Math.floor(dmg / 2)} bludgeoning damage against successful saves!`);
            }
        }
    },
    "Cave Bear": {
        "Multiattack (1/S)": {
            "once": true,
            "text": "This monster makes a Bone-Crushing Bite attack and a Claw attack.",
            "function": () => {
                // Cave Bear - Ferocious Charge Passive
                if (confirm("Did this monster move at least 10 feet before attacking?")) {
                    attack(6, 2, 6, (4 + rollMultiDice(1, 8)), "Cave Bear", "Bone-Crushing Bite", "piercing");
                    alert("The target must make a DC 13 STR saving throw or be knocked prone.");
                } else {
                    attack(6, 2, 6, 4, "Cave Bear", "Bone-Crushing Bite", "piercing");
                }
                setTimeout(() => {
                    // Cave Bear - Ferocious Charge Passive
                    if (confirm("Did this monster move at least 10 feet before attacking?")) {
                        if (confirm("Is the target prone?")) {
                            attack(6, 2, 8, (4 + rollMultiDice(1, 8) + rollMultiDice(1, 6)), "Cave Bear", "Rending Claws", "slashing");
                        } else {
                            attack(6, 2, 8, (4 + rollMultiDice(1, 8)), "Cave Bear", "Rending Claws", "slashing");
                        }
                        alert("The target must make a DC 13 STR saving throw or be knocked prone.")
                    } else {
                        if (confirm("Is the target prone?")) {
                            attack(6, 2, 8, (4 + rollMultiDice(1, 6)), "Cave Bear", "Rending Claws", "slashing");
                        } else {
                            attack(6, 2, 8, 4, "Cave Bear", "Rending Claws", "slashing");
                        }
                    }
                }, 3500);
            }
        },
        "Bone-Crushing Bite": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d6 + 4 piercing damage.",
            "function": () => {
                // Cave Bear - Ferocious Charge Passive
                if (confirm("Did this monster move at least 10 feet before attacking?")) {
                    attack(6, 2, 6, (4 + rollMultiDice(1, 8)), "Cave Bear", "Bone-Crushing Bite", "piercing");
                    alert("The target must make a DC 13 STR saving throw or be knocked prone.");
                } else {
                    attack(6, 2, 6, 4, "Cave Bear", "Bone-Crushing Bite", "piercing");
                }
            }
        },
        "Rending Claws": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d8 + 4 slashing damage. If the target is prone, this attack deals an extra 1d6 damage.",
            "function": () => {
                // Cave Bear - Ferocious Charge Passive
                if (confirm("Did this monster move at least 10 feet before attacking?")) {
                    if (confirm("Is the target prone?")) {
                        attack(6, 2, 8, (4 + rollMultiDice(1, 8) + rollMultiDice(1, 6)), "Cave Bear", "Rending Claws", "slashing");
                    } else {
                        attack(6, 2, 8, (4 + rollMultiDice(1, 8)), "Cave Bear", "Rending Claws", "slashing");
                    }
                    alert("The target must make a DC 13 STR saving throw or be knocked prone.")
                } else {
                    if (confirm("Is the target prone?")) {
                        attack(6, 2, 8, (4 + rollMultiDice(1, 6)), "Cave Bear", "Rending Claws", "slashing");
                    } else {
                        attack(6, 2, 8, 4, "Cave Bear", "Rending Claws", "slashing");
                    }
                }
            }
        }
    },
    "Chimera": {
        "Lion's Claws": {
            "text": "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 2d6 + 4 slashing damage. If the target is below half HP, this attack has advantage.",
            "function": () => {
                attack(7, 2, 6, 4, "Chimera", "Lion's Claws", "slashing");
            }
        },
        "Goat's Horns": {
            "text": "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 1d12 + 4 bludgeoning damage. If the target is prone, this attack deals an extra 1d12 damage.",
            "function": () => {
                if (confirm("Is the target prone?")) {
                    attack(7, 1, 12, (4 + rollMultiDice(1, 12)), "Chimera", "Goat's Horns", "bludgeoning");
                } else {
                    attack(7, 1, 12, 4, "Chimera", "Goat's Horns", "bludgeoning");
                }
            }
        },
        "Dragon's Bite": {
            "text": "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 2d6 + 4 piercing damage. The target must make a DC 14 CON saving throw or be poisoned.",
            "function": () => {
                attack(7, 2, 6, 4, "Chimera", "Dragon's Bite", "piercing");
                alert("The target must make a DC 14 CON saving throw or be poisoned.");
            }
        },
    },
    "Chuul": {
        "Pincer Crush": {
            "text": "Melee Weapon Attack: +6 to hit, reach 10 ft., one target. Hit: 2d6 + 4 bludgeoning damage.",
            "function": () => {
                // Chuul - Brutal Claws Passive
                if (confirm("Is this monster attacking a grappled enemy? Click OK if yes.")) {
                    attack(6, 2, 6, (4 + rollMultiDice(2, 8)), "Chuul", "Pincer Crush", "bludgeoning");
                } else {
                    attack(6, 2, 6, 4, "Chuul", "Pincer Crush", "bludgeoning");
                }
            }
        },
        "Tentacle Snare": {
            "text": "This monster attempts to grapple a creature within 10 feet. The target must make a DC 14 STR saving throw or be restrained until the start of its next turn.",
            "function": () => { alert("This monster attempts to grapple a creature within 10 feet. The target must make a DC 14 STR saving throw or be restrained until the start of its next turn."); }
        },
    },
    "Cult High Priest": {
        "Sacrificial Dagger": {
            "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1d8 + 2 slashing damage.",
            "function": () => { attack(5, 1, 8, 2, "Cult High Priest", "Sacrificial Dagger", "slashing"); }
        },
        "Blood Offering (1/S)": {
            "once": true,
            "text": "Sacrifice one of your monsters. If you sacrificed an R rarity monster, heal 1d10 HP and draw a card. If you sacrificed an SR rarity monster, heal 3d8 HP and draw a card. If you sacrificed an SSR rarity monster, heal 6d6 HP and draw 2 cards.",
            "function": () => {
                selectMonster((card) => {
                    killMonster(card);
                    setTimeout(() => {
                        let healAmount, drawAmount;
                        if (card.rarity === "R") {
                            healAmount = rollMultiDice(1, 10);
                            drawAmount = 1;
                        } else if (card.rarity === "SR") {
                            healAmount = rollMultiDice(3, 8);
                            drawAmount = 1;
                        } else if (card.rarity === "SSR") {
                            healAmount = rollMultiDice(6, 6);
                            drawAmount = 2;
                        }
                        alert("You heal for " + healAmount + " HP and draw " + drawAmount + " cards.");
                        drawCards(drawAmount);
                    }, 3000);
                });
            }
        }
    },
    "Fire Elemental": {
        "Multiattack (1/S)": {
            "once": true,
            "text": "This monster makes two Molten Grasp attacks.",
            "function": () => {
                attack(6, 2, 6, 3, "Fire Elemental", "Molten Grasp", "fire").then((hit) => {
                    if (hit) {
                        let dmg = rollMultiDice(1, 10);
                        alert("If the target is a creature or a flammable object, it ignites. Until a creature takes an action to douse the fire, the target takes" + dmg + " fire damage at the start of each of its turns.");
                    }
                });
                setTimeout(() => {
                    attack(6, 2, 6, 3, "Fire Elemental", "Molten Grasp", "fire").then((hit) => {
                        if (hit) {
                            let dmg = rollMultiDice(1, 10);
                            alert("If the target is a creature or a flammable object, it ignites. Until a creature takes an action to douse the fire, the target takes" + dmg + " fire damage at the start of each of its turns.");
                        }
                    });
                }, 3500);
            }
        },
        "Molten Grasp": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d6 + 3 fire damage. If the target is a creature or a flammable object, it ignites. Until a creature takes an action to douse the fire, the target takes 1d10 fire damage at the start of each of its turns.",
            "function": () => {
                attack(6, 2, 6, 3, "Fire Elemental", "Molten Grasp", "fire").then((hit) => {
                    if (hit) {
                        let dmg = rollMultiDice(1, 10);
                        alert("If the target is a creature or a flammable object, it ignites. Until a creature takes an action to douse the fire, the target takes" + dmg + " fire damage at the start of each of its turns.");
                    }
                });
            }
        }
    },
    "Gelatinous Cube": {
        "Pseudopod Slam": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 3d6 acid damage.",
            "function": () => { attack(4, 3, 6, 0, "Gelatinous Cube", "Pseudopod Slam", "acid"); }
        },
        "Engulf": {
            "text": "Whenever this monster enters a creature's space, the creature must make a DC 12 DEX saving throw. On a successful save, the creature can choose to be pushed 5 feet back or to the side of this monster. A creature that chooses not to be pushed suffers the consequences of a failed saving throw. On a failed save, this monster enters the creature's space, and the creature takes 3d6 acid damage and is engulfed. The engulfed creature can't breathe, is restrained, and takes 6d6 acid damage at the start of each of the cube's turns. When this monster moves, the engulfed creature moves with it. An engulfed creature can try to escape by taking an action to make a DC 12 STR check. On a success, the creature escapes and enters a space of its choice within 5 feet of this monster.",
            "function": () => {
                alert("Whenever this monster enters a creature's space, the creature must make a DC 12 DEX saving throw. On a successful save, the creature can choose to be pushed 5 feet back or to the side of this monster. A creature that chooses not to be pushed suffers the consequences of a failed saving throw. On a failed save, this monster enters the creature's space, and the creature takes 3d6 acid damage and is engulfed. The engulfed creature can't breathe, is restrained, and takes 6d6 acid damage at the start of each of the cube's turns. When this monster moves, the engulfed creature moves with it. An engulfed creature can try to escape by taking an action to make a DC 12 STR check. On a success, the creature escapes and enters a space of its choice within 5 feet of this monster.");
                let dmg = rollMultiDice(3, 6);
                let dmg2 = rollMultiDice(6, 6);
                alert(`Gelatinous Cube's Engulf deals ${dmg} acid damage against failed saves, and ${Math.floor(dmg / 2)} acid damage against successful saves! Engulfed creatures take ${dmg2} acid damage at the beginning of their turn until they escape.`);
            }
        }
    },
    "Giant Eagle": {
        "Multiattack (1/S)": {
            "once": true,
            "text": "This monster a Swooping Beak attack and a Razor Talons attack.",
            "function": () => {
                attack(5, 1, 6, 3, "Giant Eagle", "Swooping Beak", "piercing");
                setTimeout(() => {
                    attack(5, 2, 6, 3, "Giant Eagle", "Razor Talons", "slashing");
                }, 3500);
            }
        },
        "Swooping Beak": {
            "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 1d6 + 3 piercing damage.",
            "function": () => { attack(5, 1, 6, 3, "Giant Eagle", "Swooping Beak", "piercing"); }
        },
        "Razor Talons": {
            "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 2d6 + 3 slashing damage.",
            "function": () => { attack(5, 2, 6, 3, "Giant Eagle", "Razor Talons", "slashing"); }
        }
    },
    "Grick": {
        "Multiattack (1/S)": {
            "once": true,
            "text": "This monster makes a Lashing Tentacles and a Hooked Beak attack.",
            "function": () => {
                attack(4, 2, 6, 2, "Grick", "Lashing Tentacles", "slashing");
                setTimeout(() => {
                    attack(4, 1, 6, 2, "Grick", "Hooked Beak", "piercing");
                }, 3500);
            }
        },
        "Lashing Tentacles": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 2d6 + 2 slashing damage. If the target is Medium or smaller, it must make a DC 12 DEX saving throw or be grappled.",
            "function": () => {
                attack(4, 2, 6, 2, "Grick", "Lashing Tentacles", "slashing");
                alert("If the target is Medium or smaller, it must make a DC 12 DEX saving throw or be grappled.");
            }
        },
        "Hooked Beak": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1d6 + 2 piercing damage. If the target is grappled, this attack deals an extra 1d8 damage.",
            "function": () => {
                if (confirm("Is this monster attacking a grappled enemy? Click OK if yes.")) {
                    attack(4, 1, 6, (2 + rollMultiDice(1, 8)), "Grick", "Hooked Beak", "piercing");
                } else {
                    attack(4, 1, 6, 2, "Grick", "Hooked Beak", "piercing");
                }
            }
        }
    },
    "Harpy": {
        "Ripping Claws": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d6 + 3 slashing damage.",
            "function": () => { attack(6, 2, 6, 3, "Harpy", "Ripping Claws", "slashing"); }
        },
        "Luring Song": {
            "text": "This monster sings a magical melody. Choose an enemy within 30 feet. It must make a DC 14 WIS saving throw or be charmed by this monster until the end of its next turn. The charmed creature must move toward this monster and cannot take reactions.",
            "function": () => {
                alert("This monster sings a magical melody. Choose an enemy within 30 feet. It must make a DC 14 WIS saving throw or be charmed by this monster until the end of its next turn. The charmed creature must move toward this monster and cannot take reactions.");
            }
        }
    },
    "Lizardfolk Shaman": {
        "Mystical Staff": {
            "text": "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 1d6 + 2 bludgeoning damage.",
            "function": () => { attack(3, 1, 6, 2, "Lizardfolk Shaman", "Mystical Staff", "bludgeoning"); }
        },
        "Primal Guidance (1/S)": {
            "once": true,
            "text": "Choose one of your monsters on the field. Until the start of your next turn, it gains +1 AC and advantage on saving throws against magic.",
            "function": () => {
                selectMonster((card) => {
                    addEffectToMonster(card, { effect: "Until the start of your next turn, gains +1 AC and advantage on saving throws against magic.", type: "positive", source: "Primal Guidance" });
                });
            }
        }
    },
    "Merrow": {
        "Brutal Claws": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d6 + 4 slashing damage.",
            "function": () => { attack(6, 2, 6, 4, "Merrow", "Brutal Claws", "slashing"); }
        },
        "Harpoon Drag": {
            "text": "Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 2d4 + 4 piercing damage. If the target is a Huge or smaller creature, it must succeed on a STR contest against this monster or be pulled up to 20 feet toward this monster.",
            "function": () => {
                attack(6, 2, 4, 4, "Merrow", "Harpoon Drag", "piercing").then((hit) => {
                    if (hit) {
                        alert("If the target is a Huge or smaller creature, it must succeed on a STR contest against this monster or be pulled up to 20 feet toward this monster.");
                    }
                });
            }
        }
    },
    "Minotaur": {
        "Gore": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d8 + 4 piercing damage.",
            "function": () => {
                // Minotaur - Charge Passive
                if (confirm("Did this monster move 10 feet in a straight line before attacking?")) {
                    if (confirm("The target must make a DC 14 STR saving throw or be pushed 10 feet back and take an extra 2d6 bludgeoning damage. Click OK if the target failed.")) {
                        attack(6, 2, 8, (4 + rollMultiDice(2, 6)), "Minotaur", "Gore", "piercing");
                    } else {
                        attack(6, 2, 8, 4, "Minotaur", "Gore", "piercing");
                    }
                } else {
                    attack(6, 2, 8, 4, "Minotaur", "Gore", "piercing");
                }
            }
        }
    },
    "Mummy": {
        "Rotting Fist": {
            "text": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 3d6 necrotic damage. The target must make a DC 14 CON saving throw or its maximum HP is reduced by an amount equal to the necrotic damage taken.",
            "function": () => {
                attack(5, 3, 6, 0, "Mummy", "Rotting Fist", "necrotic").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 14 CON saving throw or its maximum HP is reduced by an amount equal to the necrotic damage taken.");
                    }
                });
            }
        },
        "Healing Curse (1/S)": {
            "once": true,
            "text": "Choose an enemy creature within 30 feet of this monster. It must make a DC 14 WIS saving throw or take 2d6 necrotic damage and be cursed until the end of its next turn. While cursed, the target has disadvantage on attack rolls and cannot regain HP.",
            "function": () => {
                alert("Choose an enemy creature within 30 feet of this monster. It must make a DC 14 WIS saving throw or take 2d6 necrotic damage and be cursed until the end of its next turn. While cursed, the target has disadvantage on attack rolls and cannot regain HP.");
            }
        }
    },
    "Myconid Sovereign": {
        "Toxic Fist": {
            "text": "Melee Attack: +6 to hit, reach 5 ft., one target. Hit: 1d8 + 3 bludgeoning damage. The target must make a DC 14 CON saving throw or be poisoned until the end of its next turn.",
            "function": () => {
                attack(6, 1, 8, 3, "Myconid Sovereign", "Toxic Fist", "bludgeoning").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 14 CON saving throw or be poisoned until the end of its next turn.");
                    }
                });
            }
        },
        "Animating Spores (1/S)": {
            "once": true,
            "text": "Search your discard pile for a Beast or Humanoid monster. Summon it to the field with half of its maximum HP. Return the summoned monster to the discard pile after 2 turns.",
            "function": () => {
                if (currentMonsters.length === 3) { alert("You do not have an available monster zone to use this action."); return; }
                deckView.innerHTML = "";
                let count = 0;
                for (let c in currentDiscard) {
                    if (currentDiscard[c].cardType === "Monster" && (currentDiscard[c].monsterType === "Beast" || currentDiscard[c].monsterType === "Humanoid")) {
                        count++;
                        let cardEl = document.createElement("div");
                        cardEl.classList.add("card");
                        cardEl.dataset.num = c;
                        cardEl.style.backgroundImage = `url(../assets/cards/${cardNameToImageName(currentDiscard[c].name)}.png)`;
                        cardEl.onclick = (e) => {
                            if (document.querySelector("#deckView .card.selected")) { document.querySelector("#deckView .card.selected").classList.remove("selected"); }
                            e.target.classList.add("selected");
                        };
        
                        deckView.append(cardEl);
                    }
                }
                deckViewConfirmBtn.onclick = () => {
                    if (count === 0) {
                        deckModalContainer.style.display = "none";
                        return;
                    }
                    let selectedCardNum = document.querySelector("#deckView .card.selected").dataset.num;
                    let selectedCard = currentDiscard[selectedCardNum];
                    currentDiscard.splice(selectedCardNum, 1);
                    deckModalContainer.style.display = "none";

                    summonMonster(selectedCard);
                    document.querySelector("#monsterZone" + (selectedCard.currentZone + 1) + " .monster-overlay-health").innerHTML = Math.ceil(Number(document.querySelector("#monsterZone" + (selectedCard.currentZone + 1) + " .monster-overlay-health").innerHTML) / 2);
                    addEffectToMonster(selectedCard, { effect: "Returns to the discard pile after 2 turns.", type: "negative", source: "Animating Spores", removeTurn: turnNum + 2 });
        
                    rerenderDiscard();
                };
                if (count === 0) { deckView.innerHTML = "There are no applicable cards from your discard pile."; }
                deckViewTitle.innerHTML = "Select a monster card from your discard pile";
                deckModalContainer.style.display = "flex";
            }
        }
    },
    "Owlbear": {
        "Multiattack (1/S)": {
            "once": true,
            "text": "This monster makes a Crushing Beak attack and a Raking Claws attack.",
            "function": () => {
                attack(7, 1, 10, 5, "Owlbear", "Crushing Beak", "piercing");
                setTimeout(() => {
                    attack(7, 2, 8, 5, "Owlbear", "Raking Claws", "slashing");
                }, 3500);
            }
        },
        "Crushing Beak": {
            "text": "Melee Weapon Attack: +7 to hit, reach 5 ft., one creature. Hit: 1d10 + 5 piercing damage. If this attack reduces an enemy to 0 HP, this monster may move up to 10 feet immediately.",
            "function": () => {
                attack(7, 1, 10, 5, "Owlbear", "Crushing Beak", "piercing").then((hit) => {
                    if (hit) {
                        alert("If this attack reduces an enemy to 0 HP, this monster may move up to 10 feet immediately.");
                    }
                });
            }
        },
        "Raking Claws": {
            "text": "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 2d8 + 5 slashing damage.",
            "function": () => { attack(7, 2, 8, 5, "Owlbear", "Raking Claws", "slashing"); }
        }
    },
    "Phase Spider": {
        "Venomous Ambush": {
            "text": "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 2d6 + 4 piercing damage plus 2d6 poison damage. The target must make a DC 14 CON saving throw or be poisoned for 1 minute (can repeat save at the end of each of its turns).",
            "function": () => {
                attack(4, 2, 6, 4, "Phase Spider", "Venomous Ambush", "poison").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 14 CON saving throw or be poisoned for 1 minute (can repeat save at the end of each of its turns).");
                    }
                });
            }
        }
    },
    "Vortex Serpent": {
        "Cosmic Fangs": {
            "text": "Melee Attack: +6 to hit, reach 10 ft., one target. Hit: 2d6 + 3 force damage.",
            "function": () => { attack(6, 2, 6, 3, "Vortex Serpent", "Cosmic Fangs", "force"); }
        },
        "Gravitic Crush (1/S)": {
            "once": true,
            "text": "Choose an enemy. It must make a DC 14 STR saving throw or be pulled 10 feet toward this monster and take 1d6 force damage.",
            "function": () => {
                alert("Choose an enemy. It must make a DC 14 STR saving throw or be pulled 10 feet toward this monster and take 1d6 force damage.");
                let dmg = rollMultiDice(1, 6);
                alert(`Vortex Serpent's Gravitic Crush deals ${dmg} force damage and pulls the target 10 feet towards it against a failed save!`);
            }
        }
    },
    "Winter Wolf": {
        "Frostbite Fangs": {
            "text": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 2d6 + 4 piercing damage plus 1d6 cold damage.",
            "function": () => {
                attack(6, 2, 6, 4, "Winter Wolf", "Frostbite Fangs", "piercing").then((hit) => {
                    if (hit) {
                        let extraDmg = rollDiceNoAnim(6);
                        alert("The target also receives", extraDmg, "cold damage.");
                    }
                });
            }
        },
        "Cold Breath (1/S)": {
            "once": true,
            "text": "Exhales a 15-foot cone of freezing cold. Each creature in the area must make a DC 14 DEX saving throw or take 3d6 cold damage and have their movement speed halved until the end of their next turn.",
            "function": () => {
                alert("Exhales a 15-foot cone of freezing cold. Each creature in the area must make a DC 14 DEX saving throw or take 3d6 cold damage and have their movement speed halved until the end of their next turn.");
                let dmg = rollMultiDice(3, 6);
                alert(`Winter Wolf's Cold Breath deals ${dmg} cold damage and halves movement speed until the end of their next turn against failed saves, and ${Math.floor(dmg / 2)} cold damage against successful saves!`);
            }
        }
    },
    // SSR RARITY
    "Aboleth": {
        "Tentacle Lash": {
            "text": "Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 3d6 + 6 bludgeoning damage.",
            "function": () => { attack(10, 3, 6, 6, "Aboleth", "Tentacle Lash", "bludgeoning"); }
        },
        "Enslave": {
            "text": "Choose one enemy creature within 30 feet of this monster. It must make a DC 17 WIS save or be Charmed for 1 minute.",
            "function": () => { alert("Choose one enemy creature within 30 feet of this monster. It must make a DC 17 WIS save or be Charmed for 1 minute."); }
        },
        "Psychic Drain (1/S)": {
            "once": true,
            "text": "Choose one Charmed enemy creature within 60 feet of this monster. The target takes 3d6 psychic damage, and this monster heals HP equal to the damage dealt.",
            "function": () => {
                let dmg = rollMultiDice(3, 6);
                alert(`Aboleth's Psychic Drain deals ${dmg} psychic damage, and Aboleth heals ${Math.floor(dmg / 2)} HP!`);
            }
        }
    },
    "Adult Black Dragon": {
        "Multiattack (1/S)": {
            "once": true,
            "text": "This monster makes a Doomfang Bite attack and two Tearing Claws attacks.",
            "function": () => {
                attack(11, 2, 10, 6, "Adult Black Dragon", "Doomfang Bite", "piercing").then((hit) => {
                    if (hit) {
                        let extraDmg = rollDiceNoAnim(8);
                        alert("The target also receives", extraDmg, "acid damage.");
                    }
                });
                setTimeout(() => {
                    attack(11, 2, 6, 6, "Adult Black Dragon", "Tearing Claws", "slashing");
                    setTimeout(() => {
                        attack(11, 2, 6, 6, "Adult Black Dragon", "Tearing Claws", "slashing");
                    }, 3500);
                }, 3500);
            }
        },
        "Doomfang Bite": {
            "text": "Melee Weapon Attack: +11 to hit, reach 10 ft., one target. Hit: 2d10 + 6 piercing damage plus 1d8 acid damage.",
            "function": () => {
                attack(11, 2, 10, 6, "Adult Black Dragon", "Doomfang Bite", "piercing").then((hit) => {
                    if (hit) {
                        let extraDmg = rollDiceNoAnim(8);
                        alert("The target also receives", extraDmg, "acid damage.");
                    }
                });
            }
        },
        "Tearing Claws": {
            "text": "Melee Weapon Attack: +11 to hit, reach 5 ft., one target. Hit: 2d6 + 6 slashing damage.",
            "function": () => { attack(11, 2, 6, 6, "Adult Black Dragon", "Tearing Claws", "slashing"); }
        },
        "Acid Breath (1/S)": {
            "once": true,
            "text": "This monster exhales acid in a 30-foot line. Each creature in that line must make a DC 18 DEX saving throw, taking 12d8 acid damage on a failed save, or half as much damage on a successful one.",
            "function": () => {
                alert("This monster exhales acid in a 30-foot line. Each creature in that line must make a DC 18 DEX saving throw, taking 12d8 acid damage on a failed save, or half as much damage on a successful one.");
                let dmg = rollMultiDice(12, 8);
                alert(`Adult Black Dragon's Acid Breath deals ${dmg} acid damage against failed saves, and ${Math.floor(dmg / 2)} acid damage against successful saves!`);
            }
        }
    },
    "Archmage": {
        "Arcane Dagger": {
            "text": "Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 1d6 + 2 piercing damage.",
            "function": () => { attack(6, 1, 6, 2, "Archmage", "Arcane Dagger", "piercing"); }
        }
    },
    "Iron Golem": {
        "Titanic Slam": {
            "text": "Melee Weapon Attack: +12 to hit, reach 5 ft., one target. Hit: 3d10 + 6 bludgeoning damage. The target must make a DC 17 STR saving throw or be knocked prone.",
            "function": () => {
                attack(12, 3, 10, 6, "Iron Golem", "Titanic Slam", "bludgeoning").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 17 STR saving throw or be knocked prone.");
                    }
                });
            }
        },
        "Poison Breath (1/S)": {
            "once": true,
            "text": "Exhales poisonous gas in a 15-foot cone. Each creature in the area must make a DC 16 CON saving throw or take 5d6 poison damage and become poisoned until the end of its next turn.",
            "function": () => {
                alert("Exhales poisonous gas in a 15-foot cone. Each creature in the area must make a DC 16 CON saving throw or take 5d6 poison damage and become poisoned until the end of its next turn.");
                let dmg = rollMultiDice(12, 8);
                alert(`Iron Golem's Poison Breath deals ${dmg} poison damage and poisons against failed saves, and ${Math.floor(dmg / 2)} poison damage against successful saves!`);
            }
        }
    },
    "Lich": {
        "Soulfreezing Touch": {
            "text": "Melee Spell Attack: +12 to hit, reach 5 ft., one creature. Hit: 2d10 necrotic damage. The target must succeed on a DC 16 CON saving throw or be paralyzed for 1 minute.",
            "function": () => {
                attack(12, 2, 10, 0, "Lich", "Soulfreezing Touch", "necrotic").then((hit) => {
                    if (hit) {
                        alert("The target must succeed on a DC 16 CON saving throw or be paralyzed for 1 minute.");
                    }
                });
            }
        },
        "Master of Necromancy (1/S)": {
            "once": true,
            "text": "This monster casts a spell using a Spell card from your discard pile.",
            "function": () => {
                alert("This monster casts a spell using a Spell card from your discard pile.");
            }
        }
    },
    "Mind Flayer": {
        "Extract Brain": {
            "text": "Melee Spell Attack: +10 to hit, reach 5 ft., one target. Hit: 4d10 piercing damage. If the target is stunned, it must make a DC 16 INT saving throw or be instantly destroyed.",
            "function": () => {
                attack(10, 4, 10, 0, "Mind Flayer", "Extract Brain", "piercing").then((hit) => {
                    if (hit) {
                        alert("If the target is stunned, it must make a DC 16 INT saving throw or be instantly destroyed.");
                    }
                });
            }
        },
        "Mind Blast (1/S)": {
            "once": true,
            "text": "All enemies within 15 feet must make a DC 16 INT saving throw or take 5d8 psychic damage and be stunned until the end of their next turn.",
            "function": () => {
                alert("All enemies within 15 feet must make a DC 16 INT saving throw or take 5d8 psychic damage and be stunned until the end of their next turn.");
                let dmg = rollMultiDice(5, 8);
                alert(`Mind Flayer's Mind Blast deals ${dmg} psychic damage and stuns against failed saves, and ${Math.floor(dmg / 2)} psychic damage against successful saves!`);
            }
        }
    },
    "Roc": {
        "Titanic Talons": {
            "text": "Melee Weapon Attack: +10 to hit, reach 10 ft., one target. Hit: 3d10 + 6 slashing damage. If the target is Large or smaller, they must make a DC 17 STR saving throw or be grappled.",
            "function": () => {
                attack(10, 3, 10, 6, "Roc", "Titanic Talons", "slashing").then((hit) => {
                    if (hit) {
                        alert("The target must make a DC 17 STR saving throw or be grappled.");
                    }
                });
            }
        },
        "Sonic Screech (1/S)": {
            "once": true,
            "text": "Lets out a deafening screech. All enemies within 30 feet must make a DC 17 CON saving throw or take 5d6 thunder damage and be deafened until the end of their next turn. On a successful save, they take half damage and are not deafened.",
            "function": () => {
                alert("Lets out a deafening screech. All enemies within 30 feet must make a DC 17 CON saving throw or take 5d6 thunder damage and be deafened until the end of their next turn. On a successful save, they take half damage and are not deafened.");
                let dmg = rollMultiDice(5, 6);
                alert(`Roc's Sonic Screech deals ${dmg} thunder damage and deafens against failed saves, and ${Math.floor(dmg / 2)} thunder damage against successful saves!`);
            }
        },
        "Sky's Wrath (1/S)": {
            "once": true,
            "text": "This monster drops a grappled target from the sky. The target falls to the ground and, if it falls at least 30 feet, takes 3d6 bludgeoning damage and lands prone.",
            "function": () => {
                if (confirm("Did the target fall at least 30 feet?")) {
                    let dmg = rollMultiDice(3, 6);
                    alert(`Roc's Sky's Wrath deals ${dmg} bludgeoning damage and the target is now prone!`);
                }
            }
        }
    },
    "Stone Golem": {
        "Colossal Slam": {
            "text": "Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 4d10 + 6 bludgeoning damage.",
            "function": () => { attack(10, 4, 10, 6, "Stone Golem", "Colossal Slam", "bludgeoning"); }
        },
        "Trample (1/S)": {
            "once": true,
            "text": "Choose one enemy creature within 15 feet of this monster. This monster moves to the target and then makes a Colossal Slam attack. If it hits, the target is knocked prone.",
            "function": () => {
                alert("Choose one enemy creature within 15 feet of this monster. This monster moves to the target and then makes a Colossal Slam attack. If it hits, the target is knocked prone.");
                attack(10, 4, 10, 6, "Stone Golem", "Colossal Slam", "bludgeoning").then((hit) => {
                    if (hit) {
                        alert("The target is knocked prone.");
                    }
                });
            }
        }
    },
    "Tarrasque": {
        "Devour": {
            "text": "Melee Attack: +14 to hit, reach 10 ft., one target. Hit: 4d12 + 10 piercing damage.",
            "function": () => { attack(14, 4, 12, 10, "Tarrasque", "Devour", "bludgeoning"); }
        },
        "Worldshaker (1/S)": {
            "once": true,
            "text": "This monster stomps the battlefield, forcing all creatures to make a DC 20 STR saving throw or be knocked prone and take 6d10 bludgeoning damage.",
            "function": () => {
                alert("This monster stomps the battlefield, forcing all creatures to make a DC 20 STR saving throw or be knocked prone and take 6d10 bludgeoning damage.");
                let dmg = rollMultiDice(6, 10);
                alert(`Tarrasque's Worldshaker deals ${dmg} bludgeoning damage and knocks prone against failed saves!`);
            }
        },
    },
    "Treant": {
        "Crushing Slam": {
            "text": "Melee Weapon Attack: +10 to hit, reach 5 ft., one target. Hit: 3d6 + 6 bludgeoning damage.",
            "function": () => { attack(10, 3, 6, 6, "Treant", "Crushing Slam", "bludgeoning"); }
        },
        "Entangling Roots (1/S)": {
            "once": true,
            "text": "Choose one enemy creature within 15 feet of this monster. The target must make a DC 16 STR saving throw or be restrained by the roots until the end of its next turn.",
            "function": () => {
                alert(`Choose one enemy creature within 15 feet of this monster. The target must make a DC 16 STR saving throw or be restrained by the roots until the end of its next turn.`);
            }
        },
        "Ancient Guardian (1/S)": {
            "once": true,
            "text": "Allied Plant and Beast monsters within 15 feet of this monster gain resistance to all damage types until the start of its next turn.",
            "function": () => {
                alert(`Allied Plant and Beast monsters within 15 feet of this monster gain resistance to all damage types until the start of its next turn.`);
                for (c in currentMonsters) {
                    if (currentMonsters[c].monsterType === "Plant" || currentMonsters[c].monsterType === "Beast") {
                        addEffectToMonster(currentMonsters[c], { effect: "Resists all damage types.", type: "positive", source: "Ancient Guardian" });
                    }
                }
            }
        }
    },
}

let criticalHit = false;

function displayActions(card, choicesArr) {
    choicesEl.innerHTML = "";
    for (let c in choicesArr) {
        let usedOncePerSummon = false;
        for (e in card.effects) {
            if (card.effects[e].source === choicesArr[c].name) {
                usedOncePerSummon = true;
                break;
            }
        }
        if (usedOncePerSummon) continue;
        let choiceEl = document.createElement("div");
        choiceEl.classList.add("choice");
        choiceEl.innerHTML = "<b>" + choicesArr[c].name + "</b>. " + choicesArr[c].text;
        choiceEl.addEventListener("click", () => {
            choiceModalContainer.style.display = "none";
            choicesArr[c].function();
            if (choicesArr[c].once) {
                addEffectToMonster(card, { effect: "Has used Once per Summon Action: " + choicesArr[c].name, type: "negative", source: choicesArr[c].name });
            }
        });
        choicesEl.append(choiceEl);
    }
    choiceModalContainer.style.display = "flex";
}

function rollToHit(modifier) {
    return new Promise((resolve) => {
        let roll = rollDice(20) + modifier;
        
        setTimeout(() => {
            if (roll - modifier === 20) {
                criticalHit = true;
            }

            let isHit = confirm(`Rolled a ${roll} (${roll - modifier} + ${modifier}) to hit. Press OK if the attack is a hit.`);
            resolve(isHit);
        }, 3000);
    });
}

async function attack(toHitModifier, attackDieAmount, attackDieType, attackDamageAdditive, monsterName, attackName, damageType) {
    let isHit = await rollToHit(toHitModifier);

    if (isHit) {
        let damage = rollMultiDice(attackDieAmount, attackDieType) + attackDamageAdditive;
        if (criticalHit) {
            damage = damage * 2;
            criticalHit = false;
        }
        alert(`${monsterName}'s ${attackName} deals ${damage} ${damageType} damage!`);
        return true;
    } else {
        return false;
    }
}