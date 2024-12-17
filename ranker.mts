import pokemon from './pokemon.json';
import moves from './moves.json';
import fs from 'fs';

// Spit by types

const pokemonByType = pokemon.reduce((acc, p) => {
    p.types.forEach(t => {
        if (!acc[ t ]) acc[ t ] = [];
        if (p.released) {
            acc[ t ].push(p);
        }
    });
    return acc;
}, {});

const atkPowerCalculation = (pkmn: typeof pokemon[ 0 ], type: string): number => {
    const atk = pkmn.baseStats.atk + 15;
    const translatedMoves = pkmn.fastMoves.map(m => moves.find(mv => mv.moveId === m)!);
    const highestPower = Math.max(...translatedMoves.map(m => {
        const isShadow = pkmn.tags?.includes("shadow");
        return m.power
            // STAB & type effectiveness
            * (m.type === type ? 1.2 * 1.4 : 1)
            // Shadow bonus
            * (isShadow ? 1.2 : 1)
            // attack duration
            * (1000 / m.cooldown)
            ;
    }));

    return Math.floor(0.5 * highestPower * atk) + 1;
};

const getHighestPowerMove = (pkmn: typeof pokemon[ 0 ], type: string): typeof moves[ 0 ] => {
    const translatedMoves = pkmn.fastMoves.map(m => moves.find(mv => mv.moveId === m)!);
    return translatedMoves.reduce((acc, m) => {
        const power = m.power
            * (m.type === type ? 1.2 * 1.4 : 1)
            * (pkmn.tags?.includes("shadow") ? 1.2 : 1);

        return power > acc.power ? m : acc;
    }, { power: 0 } as typeof moves[ 0 ]);
};

// Object, but sort pkmns for each type by atk power
const sortedPokemonByType = Object.keys(pokemonByType).reduce((acc, type) => {
    acc[ type ] = pokemonByType[ type ].sort((a, b) => atkPowerCalculation(b, type) - atkPowerCalculation(a, type));
    return acc;
}, {} as Record<string, typeof pokemon>);

const regions = {
    "paldean": "paldea",
    "alolan": "alola",
    "galarian": "galar",
    "hisuian": "hisui",
};

const getDexNumbers = (pkmn: typeof pokemon[ 0 ]): number[] => {
    const parent = pkmn.family?.parent;

    let dexNumbers = [ pkmn.dex ];

    if (parent) {
        dexNumbers = [ ...getDexNumbers(pokemon.find(p => p.speciesId === parent)!), ...dexNumbers ];
    }

    return dexNumbers;
};

const buildFilterString = (pkmn: typeof pokemon[ 0 ]): { ids: number[], region: string | null; } => {
    const dexNumbers = getDexNumbers(pkmn);

    const region = Object.keys(regions).find(r => (pkmn.tags as string[] || undefined)?.includes(r));

    return {
        ids: dexNumbers,
        region: region ? regions[ region ] : null,
    };
};

export function getInformationUntilRank(rank: number) {
    return Object.keys(sortedPokemonByType).reduce((acc, type) => {
        acc[ type ] = sortedPokemonByType[ type ]
            .slice(0, rank)
            .map((p) => {
                return `${p.speciesId}: ${getHighestPowerMove(p, type).moveId}`;
            })
            .flat();

        return acc;
    }, {} as Record<string, number[]>);
}

export function getFilterStringUntilRank(rank: number) {
    return Object.keys(sortedPokemonByType).reduce((acc, type) => {
        const sliced = sortedPokemonByType[ type ]
            .slice(0, rank);

        let noRegionString = sliced.filter(
            p => !p.tags?.some(t => Object.keys(regions).includes(t))
                && !(p.tags as string[] | undefined)?.includes("shadow")
        )
            .map((p) => buildFilterString(p).ids)
            .join(",");
        let noRegionStringOutput = noRegionString;
        const shadowString = sliced.filter(p => (p.tags as string[] | undefined)?.includes("shadow")).map((p, ind) => {
            const filter = buildFilterString(p);

            let string = noRegionString;
            if (ind === 0) {
                noRegionStringOutput += ',crypto';
            }

            string += ',' + filter.ids;

            return string;
        }).join(",");
        let shadowStringOutput = shadowString;
        const regionString = sliced.filter(p => p.tags?.some(t => Object.keys(regions).includes(t))).map((p, ind) => {
            const filter = buildFilterString(p);

            let string = noRegionString;
            if (ind === 0) {
                noRegionStringOutput += `,${filter.region}`;
                shadowStringOutput += `,${filter.region}`;
                if (shadowString) {
                    string += `,crypto`;
                }
            }

            string += ',' + filter.ids;

            return string;
        }).join(",");

        acc[ type ] = `${noRegionStringOutput}${shadowString ? `&${shadowStringOutput}` : ""}${regionString ? `&${regionString}` : ""}`;

        return acc;
    }, {} as Record<string, string>);
}

// export to markdown
const rankings = getInformationUntilRank(20);

let outputRankings = `# Top 20 Pokemon by Type\n\n

This list describes the best rocket counters by their quick attack strength divided by types.

## Rankings

`;

for (const type in rankings) {
    outputRankings += `## ${type}\n\n`;
    outputRankings += rankings[ type ].map((p, i) => `${i + 1}. ${p}\n`).join("");
    outputRankings += "\n";
}

let filterStrings = getFilterStringUntilRank(5);

outputRankings += "# Filter Strings\n\n";

for (const type in filterStrings) {
    outputRankings += `## ${type}\n\n${filterStrings[ type ]}\n\n`;
}

fs.writeFileSync("./README.md", outputRankings);