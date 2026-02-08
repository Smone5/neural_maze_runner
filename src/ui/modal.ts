export interface ModalOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "default" | "safety" | "warning";
}

export class Modal {
    private overlay: HTMLDivElement;
    private container: HTMLDivElement;

    constructor() {
        this.overlay = document.createElement("div");
        this.overlay.className = "modal-overlay";

        this.container = document.createElement("div");
        this.container.className = "modal-container";

        this.overlay.appendChild(this.container);
    }

    public async confirm(options: ModalOptions): Promise<boolean> {
        return new Promise((resolve) => {
            const {
                title,
                message,
                confirmText = "Continue",
                cancelText = "Cancel",
                variant = "default"
            } = options;

            this.container.className = `modal-container modal-variant-${variant}`;
            this.container.innerHTML = `
                <div class="modal-header">
                    <h2>${title}</h2>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-cancel">${cancelText}</button>
                    <button class="modal-btn modal-btn-confirm">${confirmText}</button>
                </div>
            `;

            document.body.appendChild(this.overlay);

            // Force reflow for animation
            this.overlay.offsetHeight;
            this.overlay.classList.add("active");

            const confirmBtn = this.container.querySelector(".modal-btn-confirm") as HTMLButtonElement;
            const cancelBtn = this.container.querySelector(".modal-btn-cancel") as HTMLButtonElement;

            const close = (result: boolean) => {
                this.overlay.classList.remove("active");
                setTimeout(() => {
                    if (this.overlay.parentNode) {
                        document.body.removeChild(this.overlay);
                    }
                    resolve(result);
                }, 300); // Match CSS transition
            };

            confirmBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);
            this.overlay.onclick = (e) => {
                if (e.target === this.overlay) close(false);
            };
        });
    }

    public alert(options: Omit<ModalOptions, "cancelText">): Promise<void> {
        return new Promise((resolve) => {
            const {
                title,
                message,
                confirmText = "OK",
                variant = "default"
            } = options;

            this.container.className = `modal-container modal-variant-${variant}`;
            this.container.innerHTML = `
                <div class="modal-header">
                    <h2>${title}</h2>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-confirm">${confirmText}</button>
                </div>
            `;

            document.body.appendChild(this.overlay);
            this.overlay.offsetHeight;
            this.overlay.classList.add("active");

            const confirmBtn = this.container.querySelector(".modal-btn-confirm") as HTMLButtonElement;

            const close = () => {
                this.overlay.classList.remove("active");
                setTimeout(() => {
                    if (this.overlay.parentNode) {
                        document.body.removeChild(this.overlay);
                    }
                    resolve();
                }, 300);
            };

            confirmBtn.onclick = () => close();
        });
    }
}
