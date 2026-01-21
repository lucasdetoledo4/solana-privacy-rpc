export const IDL = {
    address: "3LsgXZDcRaC3vGq3392WGuEa4AST76m8NPNQCaqDd3n6",
    metadata: {
        name: "coordinator",
        version: "0.1.0",
        spec: "0.1.0",
    },
    instructions: [
        {
            name: "initialize",
            accounts: [
                {
                    name: "coordinatorState",
                    writable: true,
                    pda: {
                        seeds: [
                            {
                                kind: "const",
                                value: [99, 111, 111, 114, 100, 105, 110, 97, 116, 111, 114],
                            },
                        ],
                    },
                },
                { name: "authority", writable: true, signer: true },
                { name: "systemProgram", address: "11111111111111111111111111111111" },
            ],
            args: [
                { name: "minBatchSize", type: "u8" },
                { name: "maxBatchSize", type: "u8" },
            ],
        },
        {
            name: "createBatch",
            accounts: [
                { name: "coordinatorState", writable: true },
                { name: "batch", writable: true },
                { name: "payer", writable: true, signer: true },
                { name: "systemProgram", address: "11111111111111111111111111111111" },
            ],
            args: [],
        },
        {
            name: "submitQuery",
            accounts: [
                { name: "coordinatorState" },
                { name: "batch", writable: true },
                { name: "submitter", signer: true },
            ],
            args: [
                { name: "batchId", type: "u64" },
                { name: "queryHash", type: { array: ["u8", 32] } },
            ],
        },
        {
            name: "finalizeBatch",
            accounts: [{ name: "coordinatorState" }, { name: "batch", writable: true }],
            args: [{ name: "batchId", type: "u64" }],
        },
        {
            name: "completeBatch",
            accounts: [
                { name: "coordinatorState" },
                { name: "batch", writable: true },
                { name: "executor", signer: true },
            ],
            args: [
                { name: "batchId", type: "u64" },
                { name: "resultsHash", type: { array: ["u8", 32] } },
            ],
        },
    ],
} as const;

export const PROGRAM_ID = "3LsgXZDcRaC3vGq3392WGuEa4AST76m8NPNQCaqDd3n6";
