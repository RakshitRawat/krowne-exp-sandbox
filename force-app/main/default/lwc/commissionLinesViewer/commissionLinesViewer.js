import { LightningElement, track, wire } from 'lwc';
import getCommissionLines from '@salesforce/apex/CommissionLinesViewerController.getCommissionLines';
import correctCommissionCode from '@salesforce/label/c.Portal_Commission_Page_Access_Code';
import { NavigationMixin } from 'lightning/navigation';

export default class CommissionMonthTiles extends NavigationMixin(LightningElement) {
    @track currentYear = new Date().getFullYear();
    @track tiles = [];
    showToast = false;
    @track variant = 'info'; // info | success | warning | error
    @track iconName = 'utility:info';
    @track variantText = 'Info';
    toastMessage = '';
    correctCode = correctCommissionCode; // change later or fetch from Apex
    otp = ['', '', '', ''];
    accessGranted = false;
    wrongPassword = false;

    // Initialize months
    allMonths = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    monthMapFull = {
        Jan: 'January',
        Feb: 'February',
        Mar: 'March',
        Apr: 'April',
        May: 'May',
        Jun: 'June',
        Jul: 'July',
        Aug: 'August',
        Sep: 'September',
        Oct: 'October',
        Nov: 'November',
        Dec: 'December'
    };

    connectedCallback() {
        const unlocked = sessionStorage.getItem('commissionAccess');
        if (unlocked === 'true') {
            this.accessGranted = true;
        }
    }

    @wire(getCommissionLines, { year: '$currentYear' })
    wiredCommissionLines({ data, error }) {
        if (data) {
            // Create a map of uploaded months
            const monthMap = {};
            data.forEach(rec => {
                monthMap[rec.Month__c] = rec.Id;
            });

            // Prepare tiles
            this.tiles = this.allMonths.map(month => {
                return {
                    title: this.monthMapFull[month],
                    id: monthMap[month] || null, // null if no record
                    hasFile: !!monthMap[month]
                };
            });
            console.log('Tiles ===> ', this.tiles);
        } else if (error) {
            console.error(error);
        }
    }

    handleTileClick(event) {
        const tileId = event.currentTarget.dataset.title;
        const tile = this.tiles.find(t => t.title === tileId);

        if (tile.hasFile) {
            // Open record in new tab
            this[NavigationMixin.GenerateUrl]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: tile.id,
                    objectApiName: 'Commission_Line__c',
                    actionName: 'view'
                }
            }).then(url => {
                window.open(url, '_blank');
            });
        } else {
            // Show SLDS toast in Community
            this.toastMessage = `No commission file uploaded for ${tile.title}`;
            this.showToast = true;
            setTimeout(() => {
                this.showToast = false;
            }, 3000);
        }
    }

    handleOtpInput(event) {
        const index = parseInt(event.target.dataset.index, 10);
        const value = event.target.value.replace(/\D/g, '');

        this.otp[index] = value;

        // Move to next box automatically
        if (value && index < 3) {
            this.template.querySelector(`input[data-index="${index + 1}"]`).focus();
        }

        // If all 4 digits entered, validate
        if (this.otp.join('').length === 4) {
            this.validateCode();
        }
    }

    handleKeyDown(event) {
        const index = parseInt(event.target.dataset.index, 10);

        // Backspace handling
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
            this.template.querySelector(`input[data-index="${index - 1}"]`).focus();
        }
    }

    validateCode() {
        if (this.otp.join('') === this.correctCode) {
            this.accessGranted = true;
            sessionStorage.setItem('commissionAccess', 'true'); // ✅ store session flag
        } else {
            this.wrongPassword = true;
            this.otp = ['', '', '', ''];
            this.template.querySelector(`input[data-index="0"]`).focus();
            this.clearInputs();
        }
    }


    clearInputs() {
        this.template.querySelectorAll('.otp-input').forEach(input => input.value = '');
    }
}