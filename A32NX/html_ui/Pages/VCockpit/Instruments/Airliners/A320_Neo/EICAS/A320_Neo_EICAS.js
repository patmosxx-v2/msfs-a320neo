class A320_Neo_EICAS extends Airliners.BaseEICAS {
    get templateID() { return "A320_Neo_EICAS"; }
    // Overriding inherited changePage function in order to modify ECAM button LED's
    changePage(_pageName, automatic = false) {
        let pageName = _pageName.toUpperCase();
        let pageState = SimVar.GetSimVarValue("L:XMLVAR_ECAM_PAGE_STATE", "number");
        if (pageState == 0 || !automatic) {
            this.SwitchToPageName(BaseEICAS.LOWER_SCREEN_GROUP_NAME, pageName);
        }

        for (var i = 0; i < this.lowerScreenPages.length; i++) {
            if (this.lowerScreenPages[i].name == pageName) {
                let original = SimVar.GetSimVarValue("L:XMLVAR_ECAM_CURRENT_PAGE", "number");
                if (pageState == 0) {
                    // If current page was selected automatically
                    if (!automatic) {
                        SimVar.SetSimVarValue("L:XMLVAR_ECAM_PAGE_STATE", "number", 1);
                    } else {
                        SimVar.SetSimVarValue("L:XMLVAR_ECAM_AUTOMATIC_PAGE", "number", i);
                    }
                    SimVar.SetSimVarValue("L:XMLVAR_ECAM_CURRENT_PAGE", "number", i);
                } else if (pageState == 1) {
                    // If current page was selected manually
                    if (!automatic) {
                        if (original == i) {
                            SimVar.SetSimVarValue("L:XMLVAR_ECAM_PAGE_STATE", "number", 0);
                            this.SwitchToPageName(BaseEICAS.LOWER_SCREEN_GROUP_NAME, this.lowerScreenPages[tempPage].name);
                            let tempPage = SimVar.GetSimVarValue("L:XMLVAR_ECAM_AUTOMATIC_PAGE", "number");
                            SimVar.SetSimVarValue("L:XMLVAR_ECAM_CURRENT_PAGE", "number", tempPage);
                        } else {
                            SimVar.SetSimVarValue("L:XMLVAR_ECAM_CURRENT_PAGE", "number", i);
                        }  
                    } else {
                        SimVar.SetSimVarValue("L:XMLVAR_ECAM_AUTOMATIC_PAGE", "number", i);
                    }
                }
                break;
            }
        }
    }
    createUpperScreenPage() {
        this.upperTopScreen = new Airliners.EICASScreen("TopScreen", "TopScreen", "a320-neo-upper-ecam");
        this.annunciations = new Cabin_Annunciations();
        this.upperTopScreen.addIndependentElement(this.annunciations);
        this.warnings = new Cabin_Warnings();
        this.upperTopScreen.addIndependentElement(this.warnings);
        this.addIndependentElementContainer(this.upperTopScreen);
        this.addIndependentElementContainer(new Airliners.EICASScreen("BottomScreenCommon", "BottomScreen", "eicas-common-display"));
    }
    createLowerScreenPages() {
        this.createLowerScreenPage("ENG", "BottomScreen", "a320-neo-lower-ecam-engine");
        this.createLowerScreenPage("BLEED", "BottomScreen", "a320-neo-lower-ecam-bleed"); // MODIFIED
        this.createLowerScreenPage("PRESS", "BottomScreen", "a320-neo-lower-ecam-press"); // MODIFIED
        this.createLowerScreenPage("ELEC", "BottomScreen", "a320-neo-lower-ecam-elec"); // MODIFIED
        this.createLowerScreenPage("HYD", "BottomScreen", "a320-neo-lower-ecam-hyd"); // MODIFIED
        this.createLowerScreenPage("FUEL", "BottomScreen", "a320-neo-lower-ecam-fuel");
        this.createLowerScreenPage("APU", "BottomScreen", "a320-neo-lower-ecam-apu");
        this.createLowerScreenPage("COND", "BottomScreen", "a320-neo-lower-ecam-cond"); // MODIFIED
        this.createLowerScreenPage("DOOR", "BottomScreen", "a320-neo-lower-ecam-door"); // MODIFIED
        this.createLowerScreenPage("WHEEL", "BottomScreen", "a320-neo-lower-ecam-wheel"); // MODIFIED
        this.createLowerScreenPage("FTCL", "BottomScreen", "a320-neo-lower-ecam-ftcl"); // MODIFIED
        // this.createLowerScreenPage("STATUS", "BottomScreen", "a320-neo-lower-ecam-status"); // MODIFIED
        // this.createLowerScreenPage("CRUISE", "BottomScreen", "a320-neo-lower-ecam-cruise"); // MODIFIED
    }
    getLowerScreenChangeEventNamePrefix() {
        return "ECAM_CHANGE_PAGE_";
    }
    Init() {
        super.Init();
        // this.changePage("FUEL", true); // MODIFIED

        this.lastAPUMasterState = 0; // MODIFIED
        this.externalPowerWhenApuMasterOnTimer = -1 // MODIFIED
        this.selfTestDiv = this.querySelector("#SelfTestDiv");
        this.selfTestTimer = -1;
        SimVar.SetSimVarValue("L:XMLVAR_ECAM_SELF_TEST_TIMER", "number", this.selfTestTimer);
        this.selfTestTimerStarted = false;
        this.doorPageActivated = false;
        this.electricity = this.querySelector("#Electricity");
        this.changePage("DOOR", true); // MODIFIED
    }
    onUpdate(_deltaTime) {
        super.onUpdate(_deltaTime);
        this.updateAnnunciations();
        
        var engineOn = Simplane.getEngineActive(0) || Simplane.getEngineActive(1);
        var externalPower = SimVar.GetSimVarValue("EXTERNAL POWER ON", "bool");
        var apuOn = SimVar.GetSimVarValue("APU SWITCH", "bool");

        var isPowerAvailable = engineOn || apuOn || externalPower;
        this.updateScreenState(isPowerAvailable);

        // Check if engine is on so self test doesn't appear when not starting from cold and dark
        if (engineOn) {
            this.selfTestDiv.style.display = "none";
            this.selfTestTimerStarted = true;
        }
        // Check if external power is on & timer not already started
        if ((externalPower || apuOn) && !this.selfTestTimerStarted) {
            this.selfTestTimer = 14.25;
            SimVar.SetSimVarValue("L:XMLVAR_ECAM_SELF_TEST_TIMER", "number", this.selfTestTimer);
            this.selfTestTimerStarted = true;
        } // timer
        if (this.selfTestTimer >= 0) {
            this.selfTestTimer -= _deltaTime / 1000;
            SimVar.SetSimVarValue("L:XMLVAR_ECAM_SELF_TEST_TIMER", "number", this.selfTestTimer);
            if (this.selfTestTimer <= 0) {
                this.selfTestDiv.style.display = "none";
            }
        }

        // modification start here
        var currentAPUMasterState = SimVar.GetSimVarValue("FUELSYSTEM VALVE SWITCH:8", "Bool");  
        // automaticaly switch to the APU page when apu master switch is on
        if (this.lastAPUMasterState != currentAPUMasterState && currentAPUMasterState === 1) {  
            this.lastAPUMasterState = currentAPUMasterState;  
            this.changePage("APU", true);

            //if external power is off when turning on apu, only show the apu page for 10 seconds, then the DOOR page
            var externalPower = SimVar.GetSimVarValue("EXTERNAL POWER ON", "Bool")  ;
            if (externalPower === 0) {  
                this.externalPowerWhenApuMasterOnTimer = 10;
            }

        }

        if (this.externalPowerWhenApuMasterOnTimer >= 0) {  
            this.externalPowerWhenApuMasterOnTimer -= _deltaTime/1000;
            if (this.externalPowerWhenApuMasterOnTimer <= 0) {  
                this.changePage("DOOR", true); 
            }  
        }  


        //automatic DOOR page switch
        var cabinDoorPctOpen = SimVar.GetSimVarValue("INTERACTIVE POINT OPEN:0", "percent");
        var cateringDoorPctOpen = SimVar.GetSimVarValue("INTERACTIVE POINT OPEN:3", "percent");
        var fwdCargoPctOpen = SimVar.GetSimVarValue("INTERACTIVE POINT OPEN:5", "percent");
        if ((cabinDoorPctOpen >= 20 || cateringDoorPctOpen >= 20 || fwdCargoPctOpen >= 20) && !this.doorPageActivated) {
            this.changePage("DOOR", true);
            this.doorPageActivated = true;
        }
        if (!(cabinDoorPctOpen >= 20 || cateringDoorPctOpen >= 20 || fwdCargoPctOpen >= 20) && this.doorPageActivated) {
            this.doorPageActivated = false;
        }
        // modification ends here
    }

    updateScreenState(isPowerAvailable) {
        if (!isPowerAvailable) {
            this.electricity.style.display = "none";
        } else {
            this.electricity.style.display = "block";
        }
    }

    updateAnnunciations() {
        let infoPanelManager = this.upperTopScreen.getInfoPanelManager();
        if (infoPanelManager) {

            // ----------- MODIFIED --------------------//
            let autoBrkValue = SimVar.GetSimVarValue("L:XMLVAR_Autobrakes_Level", "Number");
            let starterOne = SimVar.GetSimVarValue("GENERAL ENG STARTER:1", "Bool");
            let starterTwo = SimVar.GetSimVarValue("GENERAL ENG STARTER:2", "Bool");
            let splrsArmed = SimVar.GetSimVarValue("SPOILERS ARMED", "Bool");
            let flapsPosition = SimVar.GetSimVarValue("FLAPS HANDLE INDEX", "Number");
            console.log(autoBrkValue);
            // ----------- MODIFIED END --------------------//

            infoPanelManager.clearScreen(Airliners.EICAS_INFO_PANEL_ID.PRIMARY);


            if (this.warnings) {
                let text = this.warnings.getCurrentWarningText();
                if (text && text != "") {
                    let level = this.warnings.getCurrentWarningLevel();
                    switch (level) {
                        case 0:
                            infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, text, Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
                            break;
                        case 1:
                            infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, text, Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.CAUTION);
                            break;
                        case 2:
                            infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, text, Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.WARNING);
                            break;
                    }
                }
            }

            // ----------- MODIFIED --------------------//
            if (this.beforeTakeoffPhase && starterOne && starterTwo) {
                if (autoBrkValue == 3) {
                    infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, "T.O AUTO BRK MAX", Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
                } else {
                    infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, "T.O AUTO BRK......MAX", Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
                }
                infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, "\xa0\xa0\xa0\xa0SIGNS ON", Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
                if (splrsArmed) {
                    infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, "\xa0\xa0\xa0\xa0SPLRS ARM", Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
                } else {
                    infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, "\xa0\xa0\xa0\xa0SPLRS.........ARM", Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
                }
                if (flapsPosition > 0) {
                    infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, "\xa0\xa0\xa0\xa0FLAPS T.O", Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
                } else {
                    infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, "\xa0\xa0\xa0\xa0FLAPS.........T.O", Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
                }
                infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, "\xa0\xa0\xa0\xa0T.O CONFIG", Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION);
            }
            // ----------- MODIFIED END --------------------//


            else if (this.annunciations) {
                let onGround = Simplane.getIsGrounded();
                for (let i = this.annunciations.displayWarning.length - 1; i >= 0; i--) {
                    if (!this.annunciations.displayWarning[i].Acknowledged)
                        infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, this.annunciations.displayWarning[i].Text, Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.WARNING);
                }
                for (let i = this.annunciations.displayCaution.length - 1; i >= 0; i--) {
                    if (!this.annunciations.displayCaution[i].Acknowledged)
                        infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, this.annunciations.displayCaution[i].Text, Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.CAUTION);
                }
                for (let i = this.annunciations.displayAdvisory.length - 1; i >= 0; i--) {
                    if (!this.annunciations.displayAdvisory[i].Acknowledged)
                        infoPanelManager.addMessage(Airliners.EICAS_INFO_PANEL_ID.PRIMARY, this.annunciations.displayAdvisory[i].Text, (onGround) ? Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.INDICATION : Airliners.EICAS_INFO_PANEL_MESSAGE_STYLE.CAUTION);
                }
            }
        }
    }
}
registerInstrument("a320-neo-eicas-element", A320_Neo_EICAS);
//# sourceMappingURL=A320_Neo_EICAS.js.map