package expo.modules.movetoback

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMoveToBackModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoMoveToBack")

        Function("moveToBack") {
            appContext.currentActivity?.moveTaskToBack(true)
        }
    }
}
