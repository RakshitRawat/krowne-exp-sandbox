import { LightningElement, track } from 'lwc';
//import getProjects from '@salesforce/apex/ProjectController.getProjects';
import getProjectsNew from '@salesforce/apex/ProjectController.getProjectsNew';

import { NavigationMixin } from 'lightning/navigation';

export default class ProjectKanbanViewCopy extends NavigationMixin(LightningElement) {
    statuses = [
    { key: "Quoted", label: "Quoted" },
    { key: "Ordered", label: "In Production" },
    { key: "Shipped", label: "Shipped" }
    ];
    allTasks = {};             // all tasks grouped by status
    @track visibleTasks = {};  // tasks currently displayed
    batchSize = 20;            // lazy load batch size
    isHoveringDropdown = false;
    suppressHide = false;
    showFilterMenu = false;
    @track isLoading = {};     // per-column loading state
    lastRecordIdMap = {};      // track last record Id per column
    @track hasMore = {}; // ✅ NEW: Track if there are more records
    dayRange = 365;
    @track searchTerm = '';
    @track isSkeletonLoading = true;
    skeletonCards = [1, 2, 3, 4, 5];       // default filter
    @track countByStatus = {};


    connectedCallback() {
        this._handleClickOutside = this.handleClickOutside.bind(this);
        document.addEventListener('mousedown', this._handleClickOutside);

        // Initialize per-column loading states
        this.statuses.forEach(item => {
        this.isLoading[item.key] = false;
        this.hasMore[item.key] = true;
        });

        // Load all statuses in one go
        this.fetchAllStatuses();


    }

    fetchAllStatuses(lastRecordIdMap = {}) {
        this.isSkeletonLoading = true; // Show skeleton

        // Collect promises from each status fetch
        const fetchPromises = this.statuses.map(item => {
            const status = item.key;
            const lastRecordId = lastRecordIdMap[status] || '';
            const statusValue = status === 'Quoted' ? 'Open' : 'Won';
            const isShipped = status === 'Shipped';
            // Return the promise from getProjectsNewMethod
           return this.getProjectsNewMethod({
                listType: status,
                statusValue: statusValue,
                daysFilter: this.dayRange || 365,
                lastRecordId: lastRecordId,
                limitSize: this.batchSize,
                searchTerm: this.searchTerm
            });

        });

        // Wait for all fetches to complete
        Promise.all(fetchPromises)
            .then(() => {
                // Hide skeleton after all data is loaded
                this.isSkeletonLoading = false;
                console.log('All statuses loaded');
            })
            .catch(error => {
                console.error('Error fetching statuses:', error);
                this.isSkeletonLoading = false; // hide skeleton even on error
            });
    }

    formatCurrency(amount) {
        if (amount === null || amount === undefined) return '';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    getProjectsNewMethod(params) {
        if (this.isLoading[params.listType]) return Promise.resolve();

        this.isLoading[params.listType] = true;

        console.log('➡️ Calling getProjectsNew with params:', JSON.stringify(params));

        return getProjectsNew({
            limitSize: params.limitSize,
            lastRecordId: params.lastRecordId,
            status: params.statusValue,
            daysFilter: params.daysFilter,
            projectList: params.listType,
            searchTerm: params.searchTerm
        })
            .then(wrapper => {
                const result = wrapper.projects || [];
                const totalAmount = wrapper.totalProjectAmount || 0;
                const totalCount = wrapper.totalProjectCount || 0;

                // store total per column
                if (!this.totalByStatus) this.totalByStatus = {};
                 if (!this.countByStatus) this.countByStatus = {};

                if (!params.lastRecordId && wrapper.totalProjectAmount !== undefined) {
                    this.totalByStatus[params.listType] = totalAmount;
                    this.countByStatus[params.listType] = totalCount;
                }

                // init arrays
                if (!this.allTasks[params.listType]) {
                    this.allTasks[params.listType] = [];
                    this.visibleTasks[params.listType] = [];
                }

                const newTasks = result.map(p => ({
                    id: p.projectId,
                    projectName: p.projectName,
                    quotedTotal: this.formatCurrency(p.projectAmount),
                    accountName: p.accountName,
                    bidderStatus: p.bidderStatus,
                    bidderCount: p.bidderCount,
                    lastModified: this.formatDate(new Date(p.createdDate)),
                    status: params.listType,
                    dealerNames: p.dealerNames
                }));

                // append data
                this.allTasks[params.listType] = [...this.allTasks[params.listType], ...newTasks];
                this.visibleTasks[params.listType] = [...this.visibleTasks[params.listType], ...newTasks];
                //this.countByStatus[params.listType] = this.allTasks[params.listType].length;

                // pagination
                if (newTasks.length > 0) {
                    this.lastRecordIdMap[params.listType] = newTasks[newTasks.length - 1].id;
                    this.hasMore[params.listType] = true;
                } else {
                    this.hasMore[params.listType] = false;
                }

                this.isLoading[params.listType] = false;
            })
            .catch(err => {
                console.error(err);
                this.isLoading[params.listType] = false;
                this.hasMore[params.listType] = false;
            });
    }




    // getProjectsNewMethod(listType, status, isShipped, daysFilter, lastRecordId) {
    //     if (this.isLoading[listType]) return;

    //     this.isLoading[listType] = true;

    //     getProjectsNew({
    //         limitSize: this.batchSize,
    //         lastRecordId: lastRecordId || '',
    //         status: status,
    //         daysFilter: daysFilter,
    //         projectList: listType,
    //         searchTerm: this.searchTerm
    //     })
    //         .then(result => {
    //             console.log('getProjectsNew result--->', JSON.stringify(result));

    //             if (!this.allTasks[listType]) {
    //                 this.allTasks[listType] = [];
    //                 this.visibleTasks[listType] = [];
    //             }

    //             const newTasks = result.map(p => ({
    //                 id: p.projectId,
    //                 projectName: p.projectName,
    //                 quotedTotal: p.projectAmount,
    //                 accountName: p.accountName,
    //                 bidderStatus: p.bidderStatus,
    //                 bidderCount: p.bidderCount,
    //                 hasMultipleBidders: p.hasMultipleBidders,
    //                 lastModified: this.formatDate(new Date(p.createdDate)),
    //                 status: listType
    //             }));

    //             // Append to arrays
    //             this.allTasks[listType] = [...this.allTasks[listType], ...newTasks];
    //             const currentVisible = this.visibleTasks[listType] || [];
    //             this.visibleTasks = {
    //                 ...this.visibleTasks,
    //                 [listType]: [...currentVisible, ...newTasks]
    //             };

    //             // Track last record Id for lazy loading
    //             if (newTasks.length > 0) {
    //                 this.lastRecordIdMap[listType] = newTasks[newTasks.length - 1].id;
    //                 this.hasMore[listType] = true;
    //             } else {
    //                 this.hasMore[listType] = false;
    //             }

    //             this.isLoading[listType] = false;
    //         })
    //         .catch(error => {
    //             console.error(`Error fetching ${listType} (getProjectsNew):`, error);
    //             this.isLoading[listType] = false;
    //             this.hasMore[listType] = false;
    //         });
    // }


    disconnectedCallback() {
        document.removeEventListener('mousedown', this._handleClickOutside);
    }

    handleClickOutside(event) {
        if (this.suppressHide || this.isHoveringDropdown) return;

        const filterButton = this.template.querySelector('[data-id="filterButton"]');
        const dropdown = this.template.querySelector('.slds-dropdown');

        if (
            filterButton &&
            !filterButton.contains(event.target) &&
            dropdown &&
            !dropdown.contains(event.target)
        ) {
            this.showFilterMenu = false;
        }
    }

    getProjects(listType, status, isShipped, daysFilter, lastRecordId) {
        if (this.isLoading[listType]) return;
        console.log('listType---> ' + listType);
        console.log('status---> ' + status);
        console.log('isShipped---> ' + isShipped);
        console.log('daysFilter---> ' + daysFilter);
        console.log('lastRecordId---> ' + lastRecordId);
        this.isLoading[listType] = true;
        getProjects({
            listType: listType,
            limitSize: this.batchSize,
            status: status,
            isShipped: isShipped,
            lastRecordId: lastRecordId || '',
            daysFilter: daysFilter
        })
            .then(result => {
                console.log('result---> ' + JSON.stringify(result));
                if (!this.allTasks[listType]) {
                    this.allTasks[listType] = [];
                    this.visibleTasks[listType] = [];
                }

                const newTasks = result.map(p => ({
                    id: p.projectId,
                    projectName: p.projectName,
                    quotedTotal: this.formatCurrency(p.projectAmount),
                    accountName: p.accountName,
                    bidderStatus: p.bidderStatus,
                    bidderCount: p.bidderCount,
                    hasMultipleBidders: p.hasMultipleBidders,
                    lastModified: this.formatDate(new Date(p.createdDate)),
                    status: listType
                }));

                // append to arrays
                this.allTasks[listType] = [...this.allTasks[listType], ...newTasks];
                const currentVisible = this.visibleTasks[listType] || [];
                this.visibleTasks = {
                    ...this.visibleTasks,
                    [listType]: [...currentVisible, ...newTasks]
                };

                // track last record Id for next batch
                // Track last record id for next batch
                if (newTasks.length > 0) {
                    this.lastRecordIdMap[listType] = newTasks[newTasks.length - 1].id;
                    this.hasMore[listType] = true; // ✅ still have more, keep lazy loading
                } else {
                    this.hasMore[listType] = false; // ✅ stop when no data returned
                }
                this.isLoading[listType] = false;
            })
            .catch(error => {
                console.error(`Error fetching ${listType}:`, error);
                this.isLoading[listType] = false;
                this.hasMore[listType] = false; // stop further fetches on error
            });
    }

    formatDate(date) {
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
    }

    get boardData() {
    return this.statuses.map(item => ({
        status: item.key,       // internal key (IMPORTANT)
        label: item.label,      // UI label
        tasks: this.visibleTasks[item.key] || [],
        isLoading: this.isLoading[item.key] || false,
        hasMore: this.hasMore[item.key] || false,
        total: this.totalByStatus ? this.formatCurrency(this.totalByStatus[item.key] || 0) : '$0',
        count: this.countByStatus?.[item.key] || 0
    }));
    }


    searchDebounceTimer;

    handleSearch(event) {
        // Get the current search term
        this.searchTerm = event.target.value.trim();

        // Clear any existing debounce timer
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }

        // Set a new debounce timer (e.g., 300ms)
        this.searchDebounceTimer = setTimeout(() => {
            // Reset columns before fetching
            this.allTasks = {};
            this.visibleTasks = {};
            this.lastRecordIdMap = {};

            // Fetch filtered data for all statuses
            this.fetchAllStatuses();
        }, 1000); // Adjust delay as needed
    }


    handleBidderClick(event) {
        const projectId = event.currentTarget.dataset.id;

        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId: projectId,
                objectApiName: 'Project__c',
                actionName: 'view'
            }
        }).then(url => {
            window.open(url, "_self"); 
        });
    }


    baseFilters = [
        { id: '30-days', label: 'Last 30 Days' },
        { id: '60-days', label: 'Last 60 Days' },
        { id: '90-days', label: 'Last 90 Days' },
        { id: '365-days', label: 'Last 12 months' },
        { id: 'clear', label: 'Clear Filters' }
    ];

    handleDropdownMouseEnter() {
        this.isHoveringDropdown = true;
    }

    handleDropdownMouseLeave() {
        this.isHoveringDropdown = false;
    }

    toggleFilterMenu() {
        this.suppressHide = true;
        this.showFilterMenu = true;

        setTimeout(() => {
            this.suppressHide = false;
        }, 250);
    }

    get filters() {
        return this.baseFilters.map(filter => {
            return {
                ...filter,
                className: this.selectedFilter === filter.id ? 'menu-link selected' : 'menu-link'
            };
        });
    }

    handleFilter(event) {
        this.rowOffset = 0;
        let eventName = event.currentTarget.dataset.id;
        let element = this.template.querySelector(`[data-id="${eventName}"]`);
        let icon = this.template.querySelector(`[data-id="filterButton"]`);
        if (element) {
            element.style.backgroundColor = 'blue';
            element.style.color = 'white'; // Optional: for contrast
        }
        if (eventName.includes('-')) {
            icon.classList.add('custom-filter');
            this.selectedFilter = eventName;
            this.dayRange = eventName.split('-')[0];
            this.showFilterMenu = false;
            this.isHoveringDropdown = false;
            this.reloadAllColumns();
        } else {
            icon.classList.remove('custom-filter');
            this.selectedFilter = '';
            this.dayRange = null;
            this.showFilterMenu = false;
            this.isHoveringDropdown = false;
            this.reloadAllColumns();
        }
    }

    reloadAllColumns() {
        this.allTasks = {};
        this.visibleTasks = {};
        this.lastRecordIdMap = {};
        this.countByStatus = {};

        this.fetchAllStatuses();

    }
    handleScroll(event) {
        event.stopPropagation(); // Stop bubbling to window/page scroll

        const { scrollTop, scrollHeight, clientHeight } = event.target;
        const status = event.target.dataset.status;
        // ✅ do not call if no more records
        if (!this.hasMore[status]) return;
        // Check if user reached the bottom of this column
        if (scrollTop + clientHeight >= scrollHeight - 10 && !this.isLoading[status]) {
            const lastId = this.lastRecordIdMap[status] || '';
            this.getProjectsNewMethod({
                listType: status,
                statusValue: status === 'Quoted' ? 'Open' : 'Won',
                daysFilter: this.dayRange || 365,
                lastRecordId: lastId,
                limitSize: this.batchSize,
                searchTerm: this.searchTerm
            });
        }
    }
}