// Upgrade scripts for TinyCountdown module
export const upgradeScripts = [
	// Version 1.0.0 - Initial release
	function v1_0_0(context, props) {
		const result = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}
		
		// No upgrades needed for initial version
		return result
	},
]
