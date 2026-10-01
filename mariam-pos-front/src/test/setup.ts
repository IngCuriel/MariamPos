import * as fc from 'fast-check'

// Global property-based testing configuration.
// Every fast-check property runs at least 100 iterations as required by the design.
fc.configureGlobal({ numRuns: 100 })
