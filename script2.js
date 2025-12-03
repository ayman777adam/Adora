        // ===============================================
        // == منظومة Adora - الإصدار المتكامل ==============
        // ===============================================

        // ============ نظام Haptic Feedback ============
        function hapticFeedback(intensity = 'light') {
            if (navigator.vibrate) {
                const patterns = {
                    light: 10,
                    medium: 20,
                    heavy: 50
                };
                navigator.vibrate(patterns[intensity] || 10);
            }
        }
        
        // ============ حذف غرف DND (بباسورد المدير) ============
        async function clearDNDRooms() {
            hapticFeedback('medium');
            
            // نافذة مخصصة للباسورد - تصميم Soft UI
            const modalHtml = `
                <div class="modal-overlay" id="dnd-password-modal" style="display:flex;">
                    <div class="modal-content" style="max-width:400px; background:#ffffff; border-radius:20px; box-shadow:0 8px 32px rgba(0,0,0,0.12); padding:24px;">
                        <h3 style="color:#DC2626; margin-top:0; margin-bottom:8px; font-size:1.1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
                            <span>🔒</span>
                            <span>حذف غرف عدم الإزعاج</span>
                        </h3>
                        <p style="color:#64748B; margin-bottom:20px; font-size:0.9rem; text-align:right;">أدخل رمز المدير للمتابعة</p>
                        <input type="password" id="dnd-password-input" placeholder="رمز المدير" 
                            style="width:100%; padding:12px 16px; border-radius:12px; border:1px solid #e2e8f0; 
                            font-size:1rem; text-align:center; margin-bottom:20px; direction:ltr; background:#f8fafc; 
                            transition:all 0.2s; box-sizing:border-box;">
                        <div style="display:flex; gap:10px;">
                            <button onclick="confirmDNDDelete()" class="glass-btn" 
                                style="flex:1; background:rgba(220, 38, 38, 0.1) !important; color:#DC2626 !important; 
                                border:1px solid rgba(220, 38, 38, 0.2) !important; font-weight:700; height:40px; border-radius:12px;">
                                ✅ تأكيد الحذف
                            </button>
                            <button onclick="document.getElementById('dnd-password-modal').remove()" class="glass-btn" 
                                style="flex:1; background:#f1f5f9 !important; color:#475569 !important; 
                                border:1px solid #e2e8f0 !important; font-weight:700; height:40px; border-radius:12px;">
                                ❌ إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const input = document.getElementById('dnd-password-input');
            input.focus();
            
            // تأثير focus على حقل الإدخال
            input.addEventListener('focus', function() {
                this.style.borderColor = '#DC2626';
                this.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
            });
            input.addEventListener('blur', function() {
                this.style.borderColor = '#e2e8f0';
                this.style.boxShadow = 'none';
            });
            
            // Enter للتأكيد
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') confirmDNDDelete();
            });
        }
        
        async function confirmDNDDelete() {
            const pass = document.getElementById('dnd-password-input').value;
            if (!pass) {
                showMiniAlert('⚠️ أدخل الرمز', 'warning');
                return;
            }
            
            const hash = simpleHash(pass);
            if (hash !== HOTEL_CONFIG.adminHash) {
                showMiniAlert('❌ رمز خاطئ', 'error');
                document.getElementById('dnd-password-input').value = '';
                document.getElementById('dnd-password-input').focus();
                return;
            }
            
            document.getElementById('dnd-password-modal').remove();
            
            if (!db) {
                showMiniAlert('❌ غير متصل بقاعدة البيانات', 'error');
                return;
            }
            
            const dndRooms = appState.rooms.filter(r => r.type === 'dnd');
            
            if (dndRooms.length === 0) {
                showMiniAlert('⚠️ لا توجد غرف DND', 'warning');
                return;
            }
            
            try {
                toggleSyncIndicator(true);
                const batch = db.batch();
                
                dndRooms.forEach(room => {
                    // استخدام 'rooms' بدلاً من 'activeRooms'
                    const docRef = db.collection('rooms').doc(String(room.id));
                    batch.delete(docRef);
                });
                
                await batch.commit();
                
                // تحديث الحالة المحلية
                appState.rooms = appState.rooms.filter(r => r.type !== 'dnd');
                
                showMiniAlert(`✅ تم حذف ${dndRooms.length} غرفة (لا تزعج)`, 'success');
                hapticFeedback('heavy');
                smartUpdate();
                
            } catch (error) {
                console.error('Error deleting DND rooms:', error);
                showMiniAlert('❌ خطأ في الحذف', 'error');
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        // ============ WhatsApp Template Editor ============
        function openWhatsAppTemplateEditor() {
            hapticFeedback('medium');
            
            // جلب القوالب المحفوظة
            const templates = JSON.parse(localStorage.getItem('whatsappTemplates') || '{}');
            
            const defaultTemplates = {
                addRoom: '🏨 {hotelName}\n🧹 غرفة جديدة\n🔢 الغرفة: {roomNum}\n🏷️ النوع: {roomType}\n⏰ الوقت: {time}\n\n#تنظيف',
                finishRoom: '✅ {hotelName}\n🏁 غرفة مكتملة\n🔢 الغرفة: {roomNum}\n⏱️ المدة: {duration}\n✅ الحالة: {status}\n\n#مكتمل',
                report8PM: '📊 *تقرير يومي*\n🏨 {hotelName}\n📅 {date}\n\n✅ منجز: {completed}\n⚠️ نشط: {active}\n🔴 متأخر: {late}'
            };
            
            const currentTemplates = { ...defaultTemplates, ...templates };
            
            const modal = document.createElement('div');
            modal.id = 'whatsapp-template-modal';
            modal.style.cssText = `
                position: fixed; inset: 0; background: rgba(0,0,0,0.7); 
                display: flex; align-items: center; justify-content: center; 
                z-index: 9999; padding: 20px;
            `;
            
            modal.innerHTML = `
                <div style="background: var(--bg-body); border-radius: 16px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;">
                    <div style="padding: 20px; border-bottom: 2px solid var(--border-color);">
                        <h3 style="margin: 0; color: var(--primary);">✉️ محرر قوالب واتساب</h3>
                        <p style="margin: 5px 0 0 0; color: var(--text-sec); font-size: 0.85rem;">
                            تخصيص رسائل واتساب التلقائية
                        </p>
                    </div>
                    
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 8px;">📝 رسالة إضافة غرفة</label>
                            <textarea id="template-addRoom" rows="4" style="width: 100%; padding: 10px; border: 2px solid var(--border-color); border-radius: 8px; font-family: 'Cairo', sans-serif; resize: vertical;">${currentTemplates.addRoom}</textarea>
                            <p style="font-size: 0.75rem; color: var(--text-sec); margin: 5px 0 0 0;">
                                المتغيرات: {hotelName}, {roomNum}, {roomType}, {time}
                            </p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 8px;">✅ رسالة إنهاء غرفة</label>
                            <textarea id="template-finishRoom" rows="4" style="width: 100%; padding: 10px; border: 2px solid var(--border-color); border-radius: 8px; font-family: 'Cairo', sans-serif; resize: vertical;">${currentTemplates.finishRoom}</textarea>
                            <p style="font-size: 0.75rem; color: var(--text-sec); margin: 5px 0 0 0;">
                                المتغيرات: {hotelName}, {roomNum}, {duration}, {status}
                            </p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 8px;">📊 قالب التقرير اليومي</label>
                            <textarea id="template-report8PM" rows="5" style="width: 100%; padding: 10px; border: 2px solid var(--border-color); border-radius: 8px; font-family: 'Cairo', sans-serif; resize: vertical;">${currentTemplates.report8PM}</textarea>
                            <p style="font-size: 0.75rem; color: var(--text-sec); margin: 5px 0 0 0;">
                                المتغيرات: {hotelName}, {date}, {completed}, {active}, {late}
                            </p>
                        </div>
                    </div>
                    
                    <div style="padding: 15px 20px; border-top: 2px solid var(--border-color); display: flex; gap: 10px;">
                        <button onclick="saveWhatsAppTemplates()" style="
                            flex: 1; padding: 12px; background: linear-gradient(135deg, #10B981, #059669);
                            color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;
                        ">💾 حفظ</button>
                        <button onclick="resetWhatsAppTemplates()" style="
                            flex: 1; padding: 12px; background: linear-gradient(135deg, #F59E0B, #D97706);
                            color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;
                        ">🔄 استعادة الافتراضي</button>
                        <button onclick="document.getElementById('whatsapp-template-modal').remove()" style="
                            padding: 12px 20px; background: #E5E7EB; color: #374151; border: none; 
                            border-radius: 10px; font-weight: 700; cursor: pointer;
                        ">إغلاق</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
        
        function saveWhatsAppTemplates() {
            const templates = {
                addRoom: document.getElementById('template-addRoom').value,
                finishRoom: document.getElementById('template-finishRoom').value,
                report8PM: document.getElementById('template-report8PM').value
            };
            
            localStorage.setItem('whatsappTemplates', JSON.stringify(templates));
            showMiniAlert('✅ تم حفظ القوالب بنجاح', 'success');
            hapticFeedback('medium');
            document.getElementById('whatsapp-template-modal').remove();
        }
        
        function resetWhatsAppTemplates() {
            localStorage.removeItem('whatsappTemplates');
            document.getElementById('whatsapp-template-modal').remove();
            showMiniAlert('🔄 تم استعادة القوالب الافتراضية', 'success');
            hapticFeedback('medium');
        }
        
        // ============ Swipe to Archive/Delete System ============
        let swipeStartX = 0;
        let swipeStartY = 0;
        let swipeElement = null;
        
        function handleSwipeStart(event, roomId) {
            const touch = event.touches[0];
            swipeStartX = touch.clientX;
            swipeStartY = touch.clientY;
            swipeElement = event.currentTarget;
        }
        
        function handleSwipeMove(event, roomId) {
            if (!swipeElement) return;
            
            const touch = event.touches[0];
            const diffX = touch.clientX - swipeStartX;
            const diffY = touch.clientY - swipeStartY;
            
            // فقط إذا كان السحب أفقياً (وليس عمودياً)
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
                event.preventDefault();
                swipeElement.style.transform = `translateX(${diffX}px)`;
                swipeElement.style.transition = 'none';
                
                // تغيير اللون حسب الاتجاه
                if (diffX > 0) {
                    // سحب لليمين - أرشفة (أخضر)
                    swipeElement.style.background = 'linear-gradient(90deg, rgba(34, 197, 94, 0.2), var(--bg-card))';
                } else {
                    // سحب لليسار - حذف (أحمر)
                    swipeElement.style.background = 'linear-gradient(90deg, var(--bg-card), rgba(220, 38, 38, 0.2))';
                }
            }
        }
        
        async function handleSwipeEnd(event, roomId) {
            if (!swipeElement) return;
            
            const diffX = event.changedTouches[0].clientX - swipeStartX;
            
            if (Math.abs(diffX) > 120) {
                hapticFeedback('heavy');
                
                if (diffX > 0) {
                    // سحب لليمين - أرشفة سريعة
                    swipeElement.style.transform = 'translateX(100%)';
                    swipeElement.style.transition = 'transform 0.3s ease';
                    
                    setTimeout(() => {
                        openFinishModal(roomId);
                    }, 300);
                } else {
                    // سحب لليسار - حذف (تراجع)
                    swipeElement.style.transform = 'translateX(-100%)';
                    swipeElement.style.transition = 'transform 0.3s ease';
                    
                    setTimeout(() => {
                        undoLastAction(roomId);
                    }, 300);
                }
            } else {
                // إرجاع العنصر لموضعه
                swipeElement.style.transform = '';
                swipeElement.style.transition = 'transform 0.3s ease';
                swipeElement.style.background = '';
            }
            
            swipeElement = null;
        }
        
        // ============ التقرير الآلي 8PM ============
        function sendAutoReport8PM() {
            const activeRooms = appState.rooms.filter(r => r.status !== 'scheduled').length;
            const lateRooms = appState.rooms.filter(r => r.status === 'overdue').length;
            const completedToday = appState.log.length;
            const activeRequests = appState.guestRequests.filter(r => r.status !== 'scheduled').length;
            const activeMaintenance = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            
            const report = 
                `📊 *تقرير يومي - الساعة 8 مساءً*\n` +
                `🏨 ${HOTEL_CONFIG.name}\n` +
                `📅 ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
                `➖➖➖➖➖➖➖➖➖➖\n\n` +
                `✅ *الإنجاز اليومي:*\n` +
                `   🧹 غرف منظفة: ${completedToday}\n` +
                `   🚨 خروج: ${appState.log.filter(l => l.type === 'out').length}\n` +
                `   🏠 ساكن: ${appState.log.filter(l => l.type === 'stay').length}\n\n` +
                `⚠️ *الحالة النشطة:*\n` +
                `   🔵 غرف نشطة: ${activeRooms}\n` +
                `   🔴 غرف متأخرة: ${lateRooms}\n` +
                `   🛎️ طلبات نشطة: ${activeRequests}\n` +
                `   🛠️ صيانة نشطة: ${activeMaintenance}\n\n` +
                `➖➖➖➖➖➖➖➖➖➖\n` +
                `#تقرير_يومي #Adora`;
            
            // فتح واتساب برسالة جاهزة
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(report)}`;
            window.open(whatsappUrl, '_blank');
            
            showMiniAlert('📊 تم إنشاء التقرير اليومي التلقائي', 'success');
            hapticFeedback('heavy');
        }
        
        // ============ نظام الإدخال الصوتي (Voice Input) ============
        let recognition = null;
        let currentVoiceTarget = null;
        
        function initVoiceRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition = new SpeechRecognition();
                recognition.lang = 'ar-SA'; // اللغة العربية
                recognition.continuous = false;
                recognition.interimResults = false;
                
                recognition.onresult = function(event) {
                    const transcript = event.results[0][0].transcript;
                    if (currentVoiceTarget) {
                        const targetEl = document.getElementById(currentVoiceTarget);
                        if (targetEl) {
                            targetEl.value = transcript;
                            showMiniAlert('✅ تم التعرف على الصوت', 'success');
                            hapticFeedback('medium');
                        }
                    }
                };
                
                recognition.onerror = function(event) {
                    console.error('Voice recognition error:', event.error);
                    if (event.error === 'no-speech') {
                        showMiniAlert('⚠️ لم يتم اكتشاف صوت', 'warning');
                    } else {
                        showMiniAlert('❌ خطأ في التعرف على الصوت', 'error');
                    }
                    stopVoiceInput();
                };
                
                recognition.onend = function() {
                    stopVoiceInput();
                };
                
                return true;
            }
            return false;
        }
        
        function startVoiceInput(targetId) {
            if (!recognition && !initVoiceRecognition()) {
                showMiniAlert('❌ المتصفح لا يدعم الإدخال الصوتي', 'error');
                return;
            }
            
            currentVoiceTarget = targetId;
            const btn = event.target;
            
            try {
                recognition.start();
                btn.innerHTML = '⏹️';
                btn.style.background = 'linear-gradient(135deg, #10B981, #059669)';
                showMiniAlert('🎤 استمع... تحدث الآن', 'success');
                hapticFeedback('medium');
            } catch (e) {
                console.error('Error starting recognition:', e);
                showMiniAlert('❌ فشل بدء التسجيل', 'error');
            }
        }
        
        function stopVoiceInput() {
            const btns = document.querySelectorAll('[id^="voice"]');
            btns.forEach(btn => {
                btn.innerHTML = '🎤';
                btn.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
            });
            currentVoiceTarget = null;
        }
        
        // ============ نظام تنظيف الذاكرة (Memory Cleanup) ============
        const activeTimers = new Set();
        
        function registerTimer(intervalId) {
            activeTimers.add(intervalId);
            return intervalId;
        }
        
        function clearAllTimers() {
            activeTimers.forEach(id => clearInterval(id));
            activeTimers.clear();
            console.log(`🧹 تم تنظيف ${activeTimers.size} تايمر من الذاكرة`);
        }
        
        function smartSetInterval(fn, delay) {
            const id = setInterval(fn, delay);
            registerTimer(id);
            return id;
        }
        
        // ============ Error Boundary System ============
        let errorCount = 0;
        const MAX_ERRORS = 3;
        
        window.addEventListener('error', function(event) {
            errorCount++;
            console.error('🔴 خطأ غير متوقع:', event.error);
            
            if (errorCount >= MAX_ERRORS) {
                showErrorBoundary();
            } else {
                showMiniAlert(`⚠️ خطأ: ${event.message}`, 'error');
            }
        });
        
        window.addEventListener('unhandledrejection', function(event) {
            errorCount++;
            console.error('🔴 Promise غير معالج:', event.reason);
            
            if (errorCount >= MAX_ERRORS) {
                showErrorBoundary();
            } else {
                showMiniAlert('⚠️ خطأ في العملية', 'error');
            }
        });
        
        function showErrorBoundary() {
            const existingBoundary = document.getElementById('error-boundary');
            if (existingBoundary) return;
            
            const boundary = document.createElement('div');
            boundary.id = 'error-boundary';
            boundary.style.cssText = `
                position: fixed;
                inset: 0;
                background: linear-gradient(135deg, #1E293B, #0F172A);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                color: white;
                font-family: 'Cairo', sans-serif;
                padding: 20px;
                text-align: center;
            `;
            
            boundary.innerHTML = `
                <div style="background: rgba(220, 38, 38, 0.1); border: 2px solid #DC2626; border-radius: 20px; padding: 30px; max-width: 400px;">
                    <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
                    <h2 style="font-size: 1.5rem; margin-bottom: 15px; color: #DC2626;">حدث خطأ غير متوقع</h2>
                    <p style="color: rgba(255,255,255,0.7); margin-bottom: 25px; line-height: 1.6;">
                        لا تقلق، بياناتك محفوظة. سيتم إعادة تحميل التطبيق بشكل آمن.
                    </p>
                    <button onclick="location.reload()" style="
                        background: linear-gradient(135deg, #0EA5E9, #06B6D4);
                        color: white;
                        border: none;
                        padding: 15px 40px;
                        border-radius: 12px;
                        font-size: 1.1rem;
                        font-weight: 700;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
                        transition: all 0.3s;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        🔄 إعادة تحميل آمن
                    </button>
                </div>
            `;
            
            document.body.appendChild(boundary);
        }

        // ===============================================
        // == إعدادات Firebase ===========================
        // ===============================================
        
        const firebaseConfig = {
            apiKey: "AIzaSyD1rY9BUciB0ir1b8begsPozpJzgwnR-Z0",
            authDomain: "adora-staff5255.firebaseapp.com",
            projectId: "adora-staff5255",
            storageBucket: "adora-staff5255.firebasestorage.app",
            messagingSenderId: "96309381730",
            appId: "1:96309381730:web:d24e0d275255347e43df3b"
        };
        
        function simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = (hash << 5) - hash + char;
                hash = hash & 0xFFFFFFFF;

            }
            return hash;
        }

        let db;
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            
            // ============ تفعيل وضع الأوفلاين (Offline Persistence) ============
            db.enablePersistence({ synchronizeTabs: true })
                .then(() => {
                    console.log("✅ وضع الأوفلاين مفعّل: البيانات محفوظة محلياً");
                    showMiniAlert("✅ متصل - البيانات محمية", "success");
                })
                .catch((err) => {
                    if (err.code == 'failed-precondition') {
                        console.warn("⚠️ وضع الأوفلاين غير متاح: تبويبات متعددة مفتوحة");
                    } else if (err.code == 'unimplemented') {
                        console.warn("⚠️ المتصفح لا يدعم وضع الأوفلاين");
                    }
                });
            
            console.log("🏨 منظومة Adora متصلة بقاعدة البيانات.");
        } catch(e) {
            console.error("خطأ في الاتصال بقاعدة البيانات:", e);
            showMiniAlert("⚠️ فشل الاتصال بقاعدة البيانات", "error");
        }

        // ===============================================
        // == نظام الترجمة الشامل ======================
        // ===============================================
        
        const translations = {
            ar: {
                headerTitle: 'تتبع الغرف', todayStats: 'إحصائيات اليوم', newShift: 'شفت جديد',
                checkout: 'خروج', stayover: 'ساكن', requests: 'طلبات', maintenance: 'صيانة',
                lastRequest: 'آخر طلب', lastMaintenance: 'آخر صيانة', active: 'نشط', late: 'متأخر',
                roomTracking: 'تتبع الغرف', guestRequests: 'طلبات النزلاء', maintenanceSection: 'الصيانة',
                logCompleted: 'السجل (مكتمل)', archive: 'الأرشيف', showMore: 'عرض المزيد',
                searchPlaceholder: 'ابحث برقم الغرفة...', addNewRoom: 'إضافة غرفة جديدة',
                cleaning: 'تنظيف', requestsTab: 'طلبات', maintenanceTab: 'صيانة',
                roomNumber: 'رقم الغرفة', roomPlaceholder: 'مثال: 101', checkoutUrgent: 'خروج (عاجل)',
                stayoverScheduled: 'ساكن (مجدول)', inside: 'داخل', outside: 'خارج',
                scheduleTime: 'موعد التنظيف', superTurbo: 'Super Turbo (-5 min)', immediate: 'فوري',
                scheduled: 'مجدول', requestPlaceholder: 'اكتب طلب النزيل (منشفة - لحاف - وهكذا)',
                urgent: 'عاجل', maintenanceDesc: 'اكتب وصف المشكلة...', photoOptional: 'صورة (اختياري)',
                addAndSend: 'إضافة وإرسال', back: 'رجوع', roomReport: 'تقرير الغرفة',
                delayReason: 'سبب التأخير:', workload: 'ضغط العمل', roomIssue: 'مشكلة بالغرفة',
                other: 'أخرى', ready: 'جاهزة', needsMaintenance: 'صيانة', sendWhatsAppReport: 'إرسال تقرير واتساب',
                confirm: 'تأكيد', completeMaintenance: 'إنهاء الصيانة', room: 'غرفة',
                maintenanceStartTime: 'وقت بدء الصيانة:', photoRequired: 'صورة إجبارية (اضغط لرفع)',
                photoUploaded: 'تم رفع الصورة بنجاح', documentAndFinish: 'توثيق وإنهاء',
                checkoutCard: 'خروج', stayoverIn: 'ساكن (داخل)', stayoverOut: 'ساكن (خارج)',
                startNow: 'بدء الآن', arriveRoom: 'الوصول للغرفة', startInspection: 'بدء الفحص',
                finish: 'إنهاء', start: 'بدء', requestConfirm: 'هل تم تسليم {room} طلبه؟',
                yes: 'نعم', verify: 'تأكيد', passwordPlaceholder: 'كلمة المرور',
                purchasesTitle: 'قائمة المشتريات', addItem: 'إضافة', clearList: 'مسح القائمة',
                close: 'إغلاق', itemPlaceholder: 'أضف عنصراً...', emptyList: 'القائمة فارغة',
                scheduledRooms: 'غرف مجدولة', scheduledRequests: 'طلبات مجدولة', scheduledMaintenance: 'صيانة مجدولة'
            },
            en: {
                headerTitle: 'Room Tracking', todayStats: 'Today\'s Stats', newShift: 'New Shift',
                checkout: 'Checkout', stayover: 'Stayover', requests: 'Requests', maintenance: 'Maintenance',
                lastRequest: 'Last Request', lastMaintenance: 'Last Maintenance', active: 'Active', late: 'Late',
                roomTracking: 'Room Tracking', guestRequests: 'Guest Requests', maintenanceSection: 'Maintenance',
                logCompleted: 'Log (Completed)', archive: 'Archive', showMore: 'Show More',
                searchPlaceholder: 'Search by room number...', addNewRoom: 'Add New Room',
                cleaning: 'Cleaning', requestsTab: 'Requests', maintenanceTab: 'Maintenance',
                roomNumber: 'Room Number', roomPlaceholder: 'Example: 101', checkoutUrgent: 'Checkout (Urgent)',
                stayoverScheduled: 'Stayover (Scheduled)', inside: 'Inside', outside: 'Outside',
                scheduleTime: 'Scheduled Time', superTurbo: 'Super Turbo (-5 min)', immediate: 'Immediate',
                scheduled: 'Scheduled', requestPlaceholder: 'Enter guest request (towel, blanket, etc.)',
                urgent: 'Urgent', maintenanceDesc: 'Describe the issue...', photoOptional: 'Photo (Optional)',
                addAndSend: 'Add & Send', back: 'Back', roomReport: 'Room Report',
                delayReason: 'Delay Reason:', workload: 'Workload', roomIssue: 'Room Issue',
                other: 'Other', ready: 'Ready', needsMaintenance: 'Maintenance', sendWhatsAppReport: 'Send WhatsApp Report',
                confirm: 'Confirm', completeMaintenance: 'Complete Maintenance', room: 'Room',
                maintenanceStartTime: 'Maintenance Start Time:', photoRequired: 'Photo Required (Click to Upload)',
                photoUploaded: 'Photo Uploaded Successfully', documentAndFinish: 'Document & Finish',
                checkoutCard: 'Checkout', stayoverIn: 'Stayover (In)', stayoverOut: 'Stayover (Out)',
                startNow: 'Start Now', arriveRoom: 'Arrive at Room', startInspection: 'Start Inspection',
                finish: 'Finish', start: 'Start', requestConfirm: 'Request for room {room} completed?',
                yes: 'Yes', verify: 'Verify', passwordPlaceholder: 'Password',
                purchasesTitle: 'Purchases List', addItem: 'Add', clearList: 'Clear List',
                close: 'Close', itemPlaceholder: 'Add an item...', emptyList: 'List is empty',
                scheduledRooms: 'Scheduled Rooms', scheduledRequests: 'Scheduled Requests', scheduledMaintenance: 'Scheduled Maintenance'
            }
        };
        
        function t(key) {
            return translations[appState.language]?.[key] || key;
        }

        // ===============================================
        // == الثوابت والمتغيرات العامة ==================
        // ===============================================
        
        const HOTEL_CONFIG = {
            name: "الفندق",
            imgbbKey: "a7ec1c5e56839fcc6e0b6bda38257f05", 
            adminHash: 2031126303,
            times: { 
                OUT_NORM: 35 * 60000, 
                OUT_TURBO: 30 * 60000, 
                STAY_NORM: 25 * 60000, 
                STAY_TURBO: 20 * 60000, 
                TRAVEL: 15 * 60000,
                CHECKING: 15 * 60000 
            }
        };
        
        let appState = { 
            rooms: [], 
            log: [], 
            activeMaintenance: [], 
            completedMaintenanceLog: [], 
            guestRequests: [], 
            guestRequestsLog: [], 
            turbo: true,  // تلقائياً مفعّل
            searchText: "", 
            archiveViewLimit: { req: 5, maint: 5 },
            logViewLimit: 3,  // عرض آخر 3 سجلات افتراضياً
            logStep: 3,       // زيادة 3 عند الضغط على المزيد
            points: 0,
            focusMode: false,
            emergencyMode: false,
            notificationsEnabled: true,
            language: localStorage.getItem('adora_lang') || 'ar' // اللغة الافتراضية عربية
        };
        
        // قائمة المشتريات
        let purchasesList = [];
        
        // الرموز السريعة
        const quickCodes = {
            '/T1': 'طلب منشفة',
            '/T2': 'طلب مناديل',
            '/W1': 'طلب ماء',
            '/W2': 'طلب مياه غازية',
            '/C1': 'طلب قهوة',
            '/C2': 'طلب شاي',
            '/S1': 'طلب صابون',
            '/S2': 'طلب شامبو'
        };
        
        // نظام النقاط
        const pointsSystem = {
            onTime: 10,
            early: 15,
            late: 5,
            superTurbo: 20,
            urgentRequest: 25,
            maintenanceComplete: 30
        };

        let currentAddMode = 'cleaning';
        let isImmediateRequest = true;
        let isImmediateMaint = true; 
        let tempRoomId = null, activeRoomId = null, activeMaintId = null, pendingAction = null;

        // ===============================================
        // == الوظائف الأساسية (Utilities) ===============
        // ===============================================
        
        function getFormattedDate() { 
            return new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' }); 
        }
        
        // رسائل تنبيه صغيرة
        function showMiniAlert(message, type = 'info') {
            const container = document.getElementById('mini-alert-container');
            if (!container) return;
            
            const alert = document.createElement('div');
            alert.className = 'mini-alert';
            alert.style.background = type === 'error' ? 'var(--danger)' : 
                                   type === 'success' ? 'var(--success)' : 
                                   type === 'warning' ? 'var(--warning)' : 'var(--primary)';
            alert.textContent = message;
            
            container.appendChild(alert);
            
            // إزالة الرسالة بعد 3 ثواني
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 3000);
        }
        
        // تشغيل صوت الإشعار
        function playNotificationSound() {
            if (appState.notificationsEnabled) {
                try {
                    const sound = document.getElementById('notification-sound');
                    if (sound) {
                        sound.currentTime = 0;
                        sound.play();
                    }
                } catch(e) {
                    console.log("لا يمكن تشغيل الصوت");
                }
            }
        }
        
        // إظهار شريط التحفيز
        function showMotivationBar() {
            const bar = document.getElementById('motivation-bar');
            if (bar) {
                bar.style.display = 'block';
                setTimeout(() => {
                    bar.style.display = 'none';
                }, 3000);
            }
        }
        
        // اقتراح نوع الغرفة بناء على الوقت
        function suggestRoomType() {
            const hour = new Date().getHours();
            let suggestion = '';
            
            if (hour >= 8 && hour <= 12) {
                suggestion = 'خروج'; // وقت الذروة للخروج
            } else if (hour >= 13 && hour <= 17) {
                suggestion = 'ساكن'; // وقت الظهيرة
            } else if (hour >= 18 && hour <= 22) {
                suggestion = 'طلبات'; // وقت المساء
            }
            
            if (suggestion) {
                showMiniAlert(`💡 اقتراح: ${suggestion}`, 'info');
            }
        }
        
        // التحقق من الرموز السريعة
        function checkQuickCodes() {
            const textarea = document.getElementById('inpRequestDetails');
            const suggestionsDiv = document.getElementById('quick-codes-suggestions');
            if (!textarea || !suggestionsDiv) return;
            
            const text = textarea.value;
            if (text.includes('/')) {
                let suggestions = '';
                for (const [code, meaning] of Object.entries(quickCodes)) {
                    if (code.includes(text.substring(text.lastIndexOf('/')))) {
                        suggestions += `<div class="quick-code" onclick="insertQuickCode('${code}')">${code} → ${meaning}</div>`;
                    }
                }
                suggestionsDiv.innerHTML = suggestions || '';
                suggestionsDiv.style.display = suggestions ? 'block' : 'none';
            } else {
                suggestionsDiv.style.display = 'none';
            }
        }
        
        function insertQuickCode(code) {
            const textarea = document.getElementById('inpRequestDetails');
            if (textarea) {
                textarea.value = textarea.value.replace(/\/\w*$/, quickCodes[code]);
                document.getElementById('quick-codes-suggestions').style.display = 'none';
            }
        }
        
        // ===============================================
        // == نظام النقاط ================================
        // ===============================================
        
        function addPoints(amount, reason) {
            appState.points += amount;
            updatePointsDisplay();
            showMiniAlert(`🏆 +${amount} نقطة (${reason})`, 'success');
            
            // حفظ النقاط في localStorage
            localStorage.setItem('adora_points', appState.points);
        }
        
        function updatePointsDisplay() {
            const display = document.getElementById('points-display');
            if (display) {
                display.innerHTML = `🏆 ${appState.points}`;
            }
        }
        
        function loadPoints() {
            const saved = localStorage.getItem('adora_points');
            if (saved) {
                appState.points = parseInt(saved) || 0;
                updatePointsDisplay();
            }
        }

        // ===============================================
        // == نظام المشتريات =============================
        // ===============================================
        
        function showPurchasesModal() {
            const modalHTML = `
            <div class="modal-content" style="max-width:450px; background:linear-gradient(145deg, #ffffff, #f8fafc); border-radius:24px; padding:24px; box-shadow:0 12px 40px rgba(0,0,0,0.12); font-family:'Tajawal', sans-serif;">
                <h3 style="margin:0 0 20px 0; font-size:1.3rem; font-weight:800; color:#1f2937; text-align:center; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <span style="font-size:1.5rem;">🛒</span>
                    ${t('purchasesTitle')}
                </h3>
                
                <div style="background:linear-gradient(145deg, rgba(59,130,246,0.05), rgba(37,99,235,0.08)); padding:16px; border-radius:16px; margin-bottom:16px; border:1px solid rgba(59,130,246,0.15);">
                    <div style="display:flex; gap:10px; margin-bottom:12px;">
                        <input type="number" id="purchase-quantity" placeholder="${appState.language === 'ar' ? 'كمية' : 'Qty'}" min="1" 
                               style="width:70px; padding:14px 8px; border-radius:12px; border:2px solid rgba(59,130,246,0.2); font-size:1rem; font-weight:700; text-align:center; background:#fff; transition:all 0.2s;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='rgba(59,130,246,0.2)'">
                        <input type="text" id="purchase-item" placeholder="${t('itemPlaceholder')}" 
                               style="flex:1; padding:14px 16px; border-radius:12px; border:2px solid rgba(59,130,246,0.2); font-size:1rem; font-weight:600; background:#fff; transition:all 0.2s;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='rgba(59,130,246,0.2)'">
                    </div>
                    <button onclick="addToPurchasesList()" style="width:100%; padding:14px; border-radius:12px; border:none; background:linear-gradient(145deg, #3b82f6, #2563eb); color:#fff; font-size:1rem; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(59,130,246,0.3); transition:all 0.2s; font-family:'Tajawal', sans-serif;">
                        ➕ ${t('addItem')}
                    </button>
                </div>
                
                <div style="margin-top:15px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                        <span style="font-size:0.9rem; font-weight:700; color:#374151;">📋 القائمة الحالية</span>
                        <span style="font-size:0.8rem; color:#6b7280; background:rgba(107,114,128,0.1); padding:4px 10px; border-radius:20px;">${purchasesList.length} بند</span>
                    </div>
                    
                    <div id="purchases-list-container" style="max-height:280px; overflow-y:auto; margin-bottom:15px;">
                        ${purchasesList.length > 0 ? 
                            purchasesList.map((item, index) => `
                                <div style="display:flex; justify-content:space-between; align-items:center; 
                                            padding:12px 14px; background:linear-gradient(145deg, #ffffff, #f8fafc); border-radius:12px; 
                                            margin-bottom:8px; border:1px solid rgba(0,0,0,0.06); box-shadow:0 2px 6px rgba(0,0,0,0.04); transition:all 0.2s;">
                                    <div style="display:flex; align-items:center; gap:10px; flex:1;">
                                        ${item.quantity ? `<span style="font-size:1.1rem; font-weight:800; color:#3b82f6; min-width:30px;">${item.quantity}×</span>` : ''}
                                        <span style="font-weight:700; font-size:0.95rem; color:#1f2937;">${item.name}</span>
                                    </div>
                                    <button onclick="removePurchaseItem(${index})" style="background:linear-gradient(145deg, rgba(239,68,68,0.1), rgba(220,38,38,0.15)); color:#dc2626; 
                                            border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:6px 10px; font-size:0.85rem; font-weight:700; cursor:pointer; transition:0.2s;">
                                        ✕
                                    </button>
                                </div>
                            `).join('') : 
                            '<div style="text-align:center; color:#9ca3af; padding:30px 20px; background:linear-gradient(145deg, rgba(148,163,184,0.05), rgba(148,163,184,0.1)); border-radius:16px; border:2px dashed rgba(148,163,184,0.3);"><p style="font-size:1.2rem; margin-bottom:8px;">📭</p><p style="font-size:0.95rem; font-weight:600;">القائمة فارغة</p><p style="font-size:0.8rem; margin-top:6px;">أضف عناصر للبدء</p></div>'
                        }
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:15px;">
                        <button onclick="generatePurchasesReport()" style="padding:12px; border-radius:12px; border:none; background:linear-gradient(145deg, rgba(34,197,94,0.15), rgba(22,163,74,0.2)); color:#15803d; font-size:0.9rem; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(34,197,94,0.15); transition:all 0.2s; font-family:'Tajawal', sans-serif; border:1px solid rgba(34,197,94,0.25);">
                            📄 تقرير
                        </button>
                        <button onclick="clearPurchasesList()" style="padding:12px; border-radius:12px; border:none; background:linear-gradient(145deg, rgba(239,68,68,0.15), rgba(220,38,38,0.2)); color:#dc2626; font-size:0.9rem; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(239,68,68,0.15); transition:all 0.2s; font-family:'Tajawal', sans-serif; border:1px solid rgba(239,68,68,0.25);">
                            🗑️ مسح الكل
                        </button>
                    </div>
                </div>
                
                <button onclick="closeModal()" style="width:100%; margin-top:15px; padding:14px; border-radius:12px; border:1px solid rgba(100,116,139,0.2); background:linear-gradient(145deg, rgba(100,116,139,0.08), rgba(148,163,184,0.12)); color:#475569; font-size:0.95rem; font-weight:700; cursor:pointer; transition:all 0.2s; font-family:'Tajawal', sans-serif;">
                    ← رجوع
                </button>
            </div>`;
            
            const modal = document.getElementById('purchases-modal');
            modal.innerHTML = modalHTML;
            modal.style.display = 'flex';
            
            // التركيز على حقل الإدخال
            setTimeout(() => {
                const input = document.getElementById('purchase-item');
                if (input) input.focus();
            }, 100);
        }
        
        function addToPurchasesList() {
            const itemInput = document.getElementById('purchase-item');
            const quantityInput = document.getElementById('purchase-quantity');
            const itemName = itemInput.value.trim();
            const quantity = quantityInput.value.trim();
            
            if (!itemName) {
                showMiniAlert('⚠️ الرجاء إدخال اسم البند', 'warning');
                return;
            }
            
            const newItem = {
                name: itemName,
                quantity: quantity || null,
                date: new Date().toLocaleDateString('ar-EG'),
                timestamp: Date.now()
            };
            
            purchasesList.push(newItem);
            savePurchasesToStorage();
            showMiniAlert(`✅ تم إضافة "${itemName}" إلى قائمة المشتريات`, 'success');
            addPoints(5, 'إضافة مشتريات');
            
            // إعادة فتح المودال لتحديث القائمة
            setTimeout(() => {
                showPurchasesModal();
            }, 300);
        }
        
        function savePurchasesToStorage() {
            try {
                localStorage.setItem('adora_purchases_list', JSON.stringify(purchasesList));
            } catch (e) {
                console.error('خطأ في حفظ المشتريات:', e);
            }
        }
        
        function loadPurchasesFromStorage() {
            try {
                const saved = localStorage.getItem('adora_purchases_list');
                if (saved) {
                    purchasesList = JSON.parse(saved);
                }
            } catch (e) {
                console.error('خطأ في تحميل المشتريات:', e);
            }
        }
        
        function removePurchaseItem(index) {
            purchasesList.splice(index, 1);
            savePurchasesToStorage();
            showPurchasesModal();
            showMiniAlert('🗑️ تم حذف البند من القائمة', 'success');
        }
        
        function generatePurchasesReport() {
            if (purchasesList.length === 0) {
                showMiniAlert('📭 قائمة المشتريات فارغة', 'warning');
                return;
            }
            
            const currentDate = new Date().toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            let report = `🛒 *تقرير المشتريات - منظومة Adora*\n` +
                         `🏨 ${HOTEL_CONFIG.name}\n` +
                         `📅 تاريخ التقرير: ${currentDate}\n` +
                         `📋 إجمالي البنود: ${purchasesList.length}\n` +
                         `➖➖➖➖➖➖➖➖➖➖\n`;
            
            purchasesList.forEach((item, index) => {
                report += `${index + 1}. ${item.quantity ? `${item.quantity}x ` : ''}${item.name}\n`;
            });
            
            report += `\n➖➖➖➖➖➖➖➖➖➖\n` +
                      `👤 مقدم التقرير: فريق العمل\n` +
                      `#مشتريات`;
            
            window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
            showMiniAlert(`📄 تم إنشاء تقرير المشتريات (${purchasesList.length} بند)`, 'success');
            addPoints(10, 'تقرير المشتريات');
        }
        
        function clearPurchasesList() {
            if (purchasesList.length === 0) {
                showMiniAlert('القائمة فارغة بالفعل', 'info');
                return;
            }
            
            // إغلاق نافذة المشتريات حتى لا تغطي نافذة التأكيد
            const purchasesModal = document.getElementById('purchases-modal');
            if (purchasesModal) {
                purchasesModal.style.display = 'none';
            }
            
            pendingAction = 'clearPurchases';
            document.getElementById('confirm-message').innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; color: var(--danger); margin-bottom: 8px;">⚠️</div>
                    <div>هل تريد مسح جميع البنود (${purchasesList.length} بند) من قائمة المشتريات؟</div>
                    <div style="font-size: 0.8rem; color: var(--text-sec); margin-top: 5px;">
                        لا يمكن التراجع عن هذا الإجراء
                    </div>
                </div>
            `;
            
            document.getElementById('confirm-yes-btn').onclick = function() {
                purchasesList = [];
                savePurchasesToStorage();
                closeModal();
                showMiniAlert('🗑️ تم مسح قائمة المشتريات بالكامل', 'success');
                setTimeout(() => {
                    showPurchasesModal(); // إعادة فتح النافذة لتحديث القائمة
                }, 300);
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }

        // ===============================================
        // == التقرير السريع =============================
        // ===============================================
        
        function showQuickReport() {
            const activeRooms = appState.rooms.filter(r => r.status !== 'scheduled').length;
            const lateRooms = appState.rooms.filter(r => r.status === 'overdue').length;
            const urgentRequests = appState.guestRequests.filter(r => r.isUrgent && r.status !== 'scheduled').length;
            const urgentMaintenance = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            
            let report = `📊 *تقرير سريع - منظومة Adora*\n` +
                        `🏨 ${HOTEL_CONFIG.name}\n` +
                        `🕒 ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}\n` +
                        `➖➖➖➖➖➖➖\n` +
                        `🧹 الغرف النشطة: ${activeRooms}\n` +
                        `⏰ الغرف المتأخرة: ${lateRooms}\n` +
                        `🚨 طلبات عاجلة: ${urgentRequests}\n` +
                        `🛠️ صيانة عاجلة: ${urgentMaintenance}\n` +
                        `🏆 نقاطك: ${appState.points}\n` +
                        `➖➖➖➖➖➖➖\n` +
                        `#تقرير_سريع`;
            
            showMiniAlert('📊 تم إنشاء التقرير السريع', 'success');
            setTimeout(() => {
                window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
            }, 500);
        }

        // ===============================================
        // == نظام السجل الشامل =========================
        // ===============================================
        
        function showComprehensiveLog() {
            const allLogs = [
                ...(appState.log || []).map(item => ({ ...item, logType: 'cleaning' })),
                ...(appState.guestRequestsLog || []).map(item => ({ ...item, logType: 'request' })),
                ...(appState.completedMaintenanceLog || []).map(item => ({ ...item, logType: 'maintenance' }))
            ];
            
            allLogs.sort((a, b) => (b.id || 0) - (a.id || 0));
            
            const modalHTML = `
            <div class="modal-content" style="max-width: 90%; max-height: 80vh; overflow-y: auto;">
                <h3 style="color:var(--primary); margin-top:0; font-size:1.2rem; display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                    📋 السجل الشامل للعمليات
                </h3>
                
                <div class="modal-tabs" style="margin-bottom:15px;">
                    <button onclick="filterComprehensiveLog('all')" class="modal-tab-btn active" id="tab-all">الكل</button>
                    <button onclick="filterComprehensiveLog('cleaning')" class="modal-tab-btn" id="tab-cleaning-log">النظافة</button>
                    <button onclick="filterComprehensiveLog('request')" class="modal-tab-btn" id="tab-request-log">الطلبات</button>
                    <button onclick="filterComprehensiveLog('maintenance')" class="modal-tab-btn" id="tab-maintenance-log">الصيانة</button>
                </div>
                
                <div id="comprehensive-log-list" style="text-align:right;">
                    ${allLogs.length > 0 ? 
                        allLogs.slice(0, 20).map(item => createComprehensiveLogRow(item)).join('') : 
                        '<p style="text-align:center; color:var(--text-sec); padding:20px;">لا توجد سجلات بعد</p>'
                    }
                </div>
                
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button onclick="closeModal()" class="full-btn" style="background:var(--primary); flex:1;">رجوع</button>
                    <button onclick="exportComprehensiveLog()" class="full-btn" style="background:var(--success); flex:1;">📥 تصدير</button>
                </div>
            </div>`;
            
            const modal = document.getElementById('comprehensive-log-modal');
            modal.innerHTML = modalHTML;
            modal.style.display = 'flex';
            
            window.comprehensiveLogData = allLogs;
        }
        
        function filterComprehensiveLog(type) {
            const logs = window.comprehensiveLogData || [];
            let filteredLogs = logs;
            
            if (type !== 'all') {
                filteredLogs = logs.filter(item => item.logType === type);
            }
            
            ['all', 'cleaning', 'request', 'maintenance'].forEach(t => {
                const tab = document.getElementById(`tab-${t}-log`);
                if (tab) {
                    tab.classList.toggle('active', t === type);
                }
            });
            
            const container = document.getElementById('comprehensive-log-list');
            if (container) {
                container.innerHTML = filteredLogs.length > 0 ? 
                    filteredLogs.slice(0, 20).map(item => createComprehensiveLogRow(item)).join('') : 
                    '<p style="text-align:center; color:var(--text-sec); padding:20px;">لا توجد سجلات لهذا النوع</p>';
            }
        }
        
        function createComprehensiveLogRow(item) {
            // التاريخ والوقت
            const finishDate = new Date(item.finishTime || item.id || Date.now());
            const startDate = item.startTime ? new Date(item.startTime) : null;
            
            const dateStr = finishDate.toLocaleDateString('ar-EG', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            
            const startTimeStr = startDate ? startDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '--';
            const finishTimeStr = finishDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            
            // النوع والألوان
            let typeIcon = '📄';
            let typeColor = 'var(--text-sec)';
            let bgGradient = 'rgba(148,163,184,0.05)';
            let typeText = '';
            let statusBadge = '';
            
            if (item.logType === 'cleaning') {
                typeIcon = item.type === 'out' ? '🚪' : '🏠';
                typeColor = 'var(--success)';
                bgGradient = 'rgba(34,197,94,0.05)';
                typeText = item.type === 'out' ? 'خروج' : 'ساكن';
                statusBadge = item.isLate ? 
                    '<span style="background:rgba(239,68,68,0.1); color:#dc2626; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">⚠️ متأخر</span>' : 
                    '<span style="background:rgba(34,197,94,0.1); color:#15803d; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">✅ في الوقت</span>';
            } else if (item.logType === 'request') {
                typeIcon = item.isUrgent ? '🚨' : '🛎️';
                typeColor = 'var(--request-color)';
                bgGradient = 'rgba(168,85,247,0.05)';
                typeText = item.isUrgent ? 'طلب عاجل' : 'طلب نزيل';
                statusBadge = '<span style="background:rgba(168,85,247,0.1); color:#7c3aed; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">✅ تم التنفيذ</span>';
            } else if (item.logType === 'maintenance') {
                typeIcon = '🛠️';
                typeColor = 'var(--maint-color)';
                bgGradient = 'rgba(6,182,212,0.05)';
                typeText = 'صيانة';
                statusBadge = item.finishImg ? 
                    '<span style="background:rgba(6,182,212,0.1); color:#0891b2; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">✅ تم الإصلاح</span>' : 
                    '<span style="background:rgba(245,158,11,0.1); color:#d97706; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:700;">🔧 قيد العمل</span>';
            }
            
            // التفاصيل
            let detailsHtml = '';
            if (item.details) {
                detailsHtml = `<div style="font-size:0.8rem; color:#374151; margin-top:6px; padding:8px 10px; background:rgba(0,0,0,0.03); border-radius:8px; border-right:3px solid ${typeColor};">
                    📝 <strong>الطلب:</strong> ${item.details}
                </div>`;
            }
            if (item.maintDesc) {
                detailsHtml = `<div style="font-size:0.8rem; color:#374151; margin-top:6px; padding:8px 10px; background:rgba(0,0,0,0.03); border-radius:8px; border-right:3px solid ${typeColor};">
                    🔧 <strong>العطل:</strong> ${item.maintDesc}
                </div>`;
            }
            if (item.delayReason) {
                detailsHtml += `<div style="font-size:0.75rem; color:#dc2626; margin-top:4px;">
                    ⚠️ سبب التأخير: ${item.delayReason}
                </div>`;
            }
            
            // صورة الصيانة
            let imageHtml = '';
            if (item.finishImg || item.maintImg) {
                const imgUrl = item.finishImg || item.maintImg;
                imageHtml = `<div style="margin-top:8px;">
                    <a href="${imgUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(145deg, rgba(59,130,246,0.1), rgba(37,99,235,0.15)); color:#1d4ed8; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; text-decoration:none; border:1px solid rgba(59,130,246,0.2);">
                        📷 عرض صورة الإصلاح
                    </a>
                </div>`;
            }
            
            return `
            <div style="border:1px solid rgba(0,0,0,0.08); border-radius:14px; padding:14px; margin-bottom:10px; background:linear-gradient(145deg, ${bgGradient}, rgba(255,255,255,0.95)); box-shadow:0 2px 8px rgba(0,0,0,0.04); font-family:'Tajawal', sans-serif;">
                <!-- الصف العلوي: رقم الغرفة + النوع + الحالة -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:45px; height:45px; border-radius:50%; background:linear-gradient(145deg, ${typeColor}dd, ${typeColor}); display:flex; align-items:center; justify-content:center; color:white; font-size:1.3rem; box-shadow:0 3px 10px ${typeColor}40;">
                            ${typeIcon}
                        </div>
                        <div>
                            <div style="font-size:1.15rem; font-weight:800; color:#1f2937;">غرفة ${item.num}</div>
                            <div style="font-size:0.8rem; color:${typeColor}; font-weight:600;">${typeText}</div>
                        </div>
                    </div>
                    <div style="text-align:left;">
                        ${statusBadge}
                        <div style="font-size:0.7rem; color:#9ca3af; margin-top:4px;">${dateStr}</div>
                    </div>
                </div>
                
                <!-- أوقات البدء والانتهاء -->
                <div style="display:flex; gap:15px; padding:10px; background:rgba(0,0,0,0.02); border-radius:10px; margin-bottom:8px;">
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.7rem; color:#9ca3af;">🕐 البدء</div>
                        <div style="font-size:0.9rem; font-weight:700; color:#374151;">${startTimeStr}</div>
                    </div>
                    <div style="width:1px; background:rgba(0,0,0,0.1);"></div>
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.7rem; color:#9ca3af;">🏁 الانتهاء</div>
                        <div style="font-size:0.9rem; font-weight:700; color:#374151;">${finishTimeStr}</div>
                    </div>
                    <div style="width:1px; background:rgba(0,0,0,0.1);"></div>
                    <div style="flex:1; text-align:center;">
                        <div style="font-size:0.7rem; color:#9ca3af;">⏱️ المدة</div>
                        <div style="font-size:0.9rem; font-weight:800; color:${typeColor};">${item.duration || '--'}</div>
                    </div>
                </div>
                
                <!-- التفاصيل -->
                ${detailsHtml}
                
                <!-- صورة الصيانة -->
                ${imageHtml}
            </div>`;
        }
        
        function exportComprehensiveLog() {
            const logs = window.comprehensiveLogData || [];
            if (logs.length === 0) {
                showMiniAlert('لا توجد سجلات للتصدير', 'warning');
                return;
            }
            
            let report = `📋 *السجل الشامل - منظومة Adora*\n` +
                        `🏨 ${HOTEL_CONFIG.name}\n` +
                        `📅 تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}\n` +
                        `📊 إجمالي السجلات: ${logs.length}\n` +
                        `➖➖➖➖➖➖➖➖➖➖\n`;
            
            logs.slice(0, 50).forEach((item, index) => {
                const date = new Date(item.id || Date.now());
                const dateStr = date.toLocaleDateString('ar-EG');
                const typeText = item.logType === 'cleaning' ? 'تنظيف' : 
                                item.logType === 'request' ? 'طلب' : 'صيانة';
                
                report += `${index + 1}. ${typeText} - غرفة ${item.num} (${dateStr})\n`;
            });
            
            report += `\n➖➖➖➖➖➖➖➖➖➖\n` +
                     `👤 مقدم التقرير: فريق العمل\n` +
                     `#سجل_شامل`;
            
            window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
            showMiniAlert(`📄 تم إنشاء تقرير السجل الشامل (${logs.length} سجل)`, 'success');
        }

        // ===============================================
        // == التحكم في النوافذ (Modals) =================
        // ===============================================
        
        function setDelayReason(reason, el) { 
            document.getElementById('modal-delay').value = reason; 
            
            // إزالة التحديد من كل الأزرار
            ['dly_work', 'dly_room', 'dly_other'].forEach(id => {
                const btn = document.getElementById(id);
                if(btn) { 
                    btn.classList.remove('selected');
                }
            }); 
            
            // تحديد الزر المضغوط
            if(el) { 
                el.classList.add('selected');
            }
        }
        
        function openFinishModal(id) { 
            activeRoomId = id; 
            const room = appState.rooms.find(r => r.id === id); 
            if (!room) return; 
            
            // حساب إذا كانت متأخرة
            const isLate = room.status === 'overdue' || Date.now() > room.deadline;
            document.getElementById('delay-reason-section').style.display = isLate ? 'block' : 'none'; 
            document.getElementById('modal-delay').value = ''; 
            document.getElementById('repair-details-input').value = ''; 
            document.getElementById('modal-img-camera-input').value = ''; 
            document.getElementById('inpSendWhatsapp').checked = false; 
            
            // إضافة رسالة تشجيعية
            let title = '📝 تقرير الغرفة';
            if (isLate) {
                const delayMinutes = Math.floor((Date.now() - room.deadline) / 60000);
                title = `⏰ تأخرت ${delayMinutes} دقيقة - حاول التعجل المرة القادمة`;
            } else {
                title = '⭐ ممتاز! أنهيت في الوقت المحدد';
            }
            document.getElementById('finish-title').innerText = title;
            
            setRoomStatus('جاهزة');
            document.getElementById('final-modal').style.display = 'flex'; 
        }
        
        function openCompleteMaintenanceModal(id) { 
            activeMaintId = id; 
            const maint = appState.activeMaintenance.find(m => m.id === id); 
            if (!maint) return; 
            
            document.getElementById('maint-room-num-display').innerText = `غرفة ${maint.num}`; 
            document.getElementById('maint-img-camera-input').value = ''; 
            
            // عرض وقت بدء الصيانة
            if (maint.startTime) {
                const startTime = new Date(maint.startTime).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                document.getElementById('maint-start-time').innerText = startTime;
            }
            
            document.getElementById('complete-maint-modal').style.display = 'flex'; 
        }
        
        function checkDuplicate() { 
            const num = document.getElementById('inpRoomNum').value; 
            const exists = appState.rooms.find(r => r.num == String(num)); 
            const alertBox = document.getElementById('room-dup-alert'); 
            
            // البحث عن آخر طلب/صيانة للغرفة
            const lastRequest = appState.guestRequestsLog
                .filter(r => r.num == num)
                .sort((a, b) => (b.finishTime || b.id) - (a.finishTime || a.id))[0];
            const lastMaint = appState.completedMaintenanceLog
                .filter(m => m.num == num)
                .sort((a, b) => (b.finishTime || b.id) - (a.finishTime || a.id))[0];
            
            let historyInfo = '';
            if (lastRequest) {
                const time = new Date(lastRequest.finishTime || lastRequest.id);
                const timeStr = time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
                // استخراج كلمة مختصرة من تفاصيل الطلب
                const reqDetails = lastRequest.details || '';
                const shortReq = reqDetails.split(' ')[0] || 'طلب';
                historyInfo += `<div style="font-size:0.8rem; color:var(--request-color); margin-top:4px;">🛎️ آخر طلب: ${shortReq} - ${timeStr}</div>`;
            }
            if (lastMaint) {
                const time = new Date(lastMaint.finishTime || lastMaint.id);
                const timeStr = time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
                // استخراج كلمة مختصرة من تفاصيل الصيانة
                const maintDetails = lastMaint.maintDesc || '';
                const shortMaint = maintDetails.split(' ')[0] || 'صيانة';
                historyInfo += `<div style="font-size:0.8rem; color:var(--maint-color); margin-top:4px;">🛠️ آخر صيانة: ${shortMaint} - ${timeStr}</div>`;
            }
            
            if (exists) { 
                if (currentAddMode === 'cleaning') {
                    // Hard Block: لا يمكن إضافة تنظيف على غرفة نشطة
                    alertBox.style.display = 'block'; 
                    alertBox.innerHTML = `⚠️ الغرفة ${num} نشطة بالفعل!${historyInfo}`; 
                } else {
                    // Soft Warning: يسمح بإضافة طلب/صيانة مع تنبيه
                    alertBox.style.display = 'block'; 
                    alertBox.style.background = 'rgba(250, 204, 21, 0.15)';
                    alertBox.style.color = 'var(--warning)';
                    alertBox.innerHTML = `💡 الغرفة ${num} قيد التنظيف. يمكنك إضافة ${currentAddMode === 'request' ? 'طلب' : 'صيانة'} على أي حال.${historyInfo}`; 
                }
            } else { 
                alertBox.style.display = historyInfo ? 'block' : 'none';
                if (historyInfo) {
                    alertBox.style.background = 'rgba(56, 189, 248, 0.1)';
                    alertBox.style.color = 'var(--text-main)';
                    alertBox.innerHTML = historyInfo;
                }
            } 
        }
        
        function openAddModal() { 
            hapticFeedback('light');
            
            document.getElementById('inpRoomNum').value = ''; 
            document.getElementById('room-dup-alert').style.display = 'none'; 
            document.getElementById('inpRoomType').value = ''; 
            
            // مسح selected من جميع أزرار الاختيار
            document.querySelectorAll('.modal-select-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // مسح اختيارات الحالة
            document.querySelectorAll('.guest-status-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            document.getElementById('inpSuperTurbo').checked = false; 
            document.getElementById('inpRequestDetails').value = ''; 
            document.getElementById('inpMaintDetails').value = ''; 
            document.getElementById('inpMaintImage').value = ''; 
            
            // تعيين الحد الأدنى للتاريخ والوقت (اليوم فقط، ومنع الوقت الماضي)
            setMinDateTime();
            
            // تعيين الوضع الافتراضي
            currentAddMode = 'cleaning';
            switchAddMode('cleaning'); 
            setRequestMode('immediate'); 
            setMaintMode('immediate'); 
            
            document.getElementById('addRoomModal').style.display = 'flex'; 
        }
        
        function setMinDateTime() {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
            
            // تعيين اليوم كحد أدنى
            const dateInputs = ['systemDateInput', 'systemDateInputReq', 'systemDateInputMaint'];
            dateInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.min = today;
                    el.value = today;
                    
                    // عند تغيير التاريخ، نتحقق من الوقت
                    el.addEventListener('change', function() {
                        const selectedDate = this.value;
                        const timeInputId = id.replace('Date', 'Time');
                        const timeInput = document.getElementById(timeInputId);
                        
                        if (selectedDate === today && timeInput) {
                            timeInput.min = currentTime;
                            // إذا كان الوقت المحدد أقل من الوقت الحالي، نعيّنه للوقت الحالي
                            if (timeInput.value < currentTime) {
                                timeInput.value = currentTime;
                            }
                        } else if (timeInput) {
                            timeInput.min = '00:00';
                        }
                    });
                }
            });
            
            // تعيين الوقت الحالي
            const timeInputs = ['systemTimeInput', 'systemTimeInputReq', 'systemTimeInputMaint'];
            timeInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.min = currentTime;
                    el.value = currentTime;
                }
            });
        }
        
        function showLogClearModal() { 
            pendingAction = 'clearLog'; 
            document.getElementById('admin-password').value = ''; 
            document.getElementById('password-modal').style.display = 'flex'; 
        }
        
        function showNewShiftModal() { 
            pendingAction = 'newShift'; 
            document.getElementById('admin-password').value = ''; 
            document.getElementById('password-modal').style.display = 'flex'; 
        }
        
function toggleArchive(type) {
    if (!appState.isArchiveView) {
        appState.isArchiveView = { req: false, maint: false };
    }

    // تبديل النوع المطلوب فقط بدون ما نلمس النوع الآخر
    appState.isArchiveView[type] = !appState.isArchiveView[type];

    const reqContainer = document.getElementById('req-archive-container');
    const maintContainer = document.getElementById('maint-archive-container');

    if (reqContainer) {
        reqContainer.style.display = appState.isArchiveView.req ? 'block' : 'none';
        if (appState.isArchiveView.req) renderGuestRequestsArchive();
    }

    if (maintContainer) {
        maintContainer.style.display = appState.isArchiveView.maint ? 'block' : 'none';
        if (appState.isArchiveView.maint) renderMaintenanceArchive();
    }

    renderGuestRequests();
    renderMaintenanceCards();
}



      function renderGuestRequestsArchive() {
    const archiveContainer = document.getElementById('req-archive-container');
    // عنصر داخلي مخصص للقائمة إن وُجد، وإلا نستخدم الـ container نفسه
    const list = document.getElementById('guest-requests-archive-list') || archiveContainer;
    if (!archiveContainer || !list) return;

    const archiveReqs = Array.isArray(appState.guestRequestsLog) ? appState.guestRequestsLog : [];

    if (archiveReqs.length === 0) {
        list.innerHTML = '<p class="no-data">لا توجد طلبات مؤرشفة</p>';
        const btnMore = document.getElementById('btn-more-req');
        if (btnMore) btnMore.style.display = 'none';
        return;
    }

    const limit = appState.archiveViewLimit?.req || 10;
    const visible = archiveReqs.slice(0, limit);

    let html = '';
    visible.forEach(req => {
        html += `
            <div class="archive-item">
                <div class="archive-title">${req.title || 'طلب بدون عنوان'}</div>
                <div class="archive-desc">${req.description || 'لا يوجد وصف'}</div>
                <small class="archive-date">
                    📅 ${new Date(req.archivedAt || req.completedAt || Date.now()).toLocaleString('ar-SA')}
                </small>
            </div>
        `;
    });

    list.innerHTML = html;

    const btnMore = document.getElementById('btn-more-req');
    if (btnMore) btnMore.style.display = archiveReqs.length > limit ? 'block' : 'none';
}

  
        function loadMoreLog() {
            appState.logViewLimit += appState.logStep;
            renderLogSection();
        }
        
        function switchAddMode(mode) { 
            currentAddMode = mode; 
            hapticFeedback('medium');
            
            // إخفاء كل الخيارات
            ['cleaning', 'request', 'maintenance'].forEach(m => { 
                document.getElementById(`${m}-options`).style.display = 'none'; 
            }); 
            
            // إزالة active من كل الأزرار
            document.querySelectorAll('.add-mode-tab').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // إضافة active للزر المختار
            document.getElementById(`tab-${mode}`).classList.add('active');
            
            // إظهار الخيارات المناسبة
            document.getElementById(`${mode}-options`).style.display = 'block'; 
            
            // تحديث العنوان
            const titles = {
                cleaning: t('addNewRoom'),
                request: appState.language === 'ar' ? 'إضافة طلب نزيل' : 'Add Guest Request',
                maintenance: appState.language === 'ar' ? 'تسجيل صيانة' : 'Register Maintenance'
            };
            document.getElementById('modal-title-add').innerText = titles[mode]; 
            
            checkDuplicate();
        }
        
        function setRequestMode(mode) { 
            isImmediateRequest = (mode === 'immediate'); 
            hapticFeedback('medium');
            
            // إزالة selected من كل الأزرار
            document.getElementById('btn-req-imm').classList.remove('selected');
            document.getElementById('btn-req-sch').classList.remove('selected');
            
            // إضافة selected للزر المختار
            if (isImmediateRequest) {
                document.getElementById('btn-req-imm').classList.add('selected');
            } else {
                document.getElementById('btn-req-sch').classList.add('selected');
            }
            
            document.getElementById('request-schedule-container').style.display = isImmediateRequest ? 'none' : 'block'; 
        }
        
        function setMaintMode(mode) { 
            isImmediateMaint = (mode === 'immediate'); 
            hapticFeedback('medium');
            
            // إزالة selected من كل الأزرار
            document.getElementById('btn-maint-imm').classList.remove('selected');
            document.getElementById('btn-maint-sch').classList.remove('selected');
            
            // إضافة selected للزر المختار
            if (isImmediateMaint) {
                document.getElementById('btn-maint-imm').classList.add('selected');
            } else {
                document.getElementById('btn-maint-sch').classList.add('selected');
            }
            
            document.getElementById('maint-schedule-container').style.display = isImmediateMaint ? 'none' : 'block'; 
        }
        
        function setRoomType(type) { 
            document.getElementById('inpRoomType').value = type; 
            hapticFeedback('medium');
            
            // إزالة selected من كل الأزرار
            document.querySelectorAll('#opt_out, #opt_stay, #opt_dnd').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // إضافة selected للزر المختار
            if (type === 'out') {
                document.getElementById('opt_out').classList.add('selected');
            } else if (type === 'stay') {
                document.getElementById('opt_stay').classList.add('selected');
                // تعيين حالة النزيل الافتراضية إلى "خارج"
                setTimeout(() => setGuestStatus('out'), 100);
            } else if (type === 'dnd') {
                document.getElementById('opt_dnd').classList.add('selected');
            }
            
            // إخفاء خيارات الساكن إذا كان DND أو خروج
            document.getElementById('stayOptionsCleaning').style.display = (type === 'out' || type === 'dnd') ? 'none' : 'block';
            
            // إظهار رسالة للDND
            if (type === 'dnd') {
                showMiniAlert('🚫 وضع عدم الإزعاج: لن يتم فتح هذه الغرفة', 'info');
            }
        }
        
        function setGuestStatus(status) { 
            document.getElementById('inpGuestStatus').value = status; 
            hapticFeedback('medium');
            
            // تحديث المظهر - فقط أزرار داخل/خارج
            const toggleContainer = document.querySelector('.in-out-toggle');
            if (toggleContainer) {
                toggleContainer.querySelectorAll('.io-btn').forEach(btn => {
                    btn.classList.remove('active', 'selected');
                });
                
                if (status === 'in') {
                    document.getElementById('gst_clean_in').classList.add('active', 'selected');
                } else {
                    document.getElementById('gst_clean_out').classList.add('active', 'selected');
                }
            }
        }
        
        function setRoomStatus(status) { 
            document.getElementById('modal-notes').value = status; 
            
            // إزالة التحديد من كلا الزرين
            document.getElementById('st_ready').classList.remove('selected');
            document.getElementById('st_maint').classList.remove('selected');
            
            // تحديد الزر المناسب
            if (status === 'جاهزة') {
                document.getElementById('st_ready').classList.add('selected');
            } else {
                document.getElementById('st_maint').classList.add('selected');
            }
            
            document.getElementById('maintenance-fields').style.display = status === 'جاهزة' ? 'none' : 'block'; 
        }
        
        function promptAction(id, type) { 
            const room = appState.rooms.find(r => r.id === id);
            if (!room) return;
            
            let message = '';
            let title = '';
            
            if (type === 'arrival') {
                title = 'الوصول للغرفة';
                message = `🏃 *الوصول للغرفة*\n\n🔢 الغرفة: ${room.num}\n\nهل وصلت للغرفة وجاهز لبدء التنظيف؟`;
            } else if (type === 'clean') {
                title = 'بدء الفحص';
                message = `🔍 *فحص الغرفة*\n\n🔢 الغرفة: ${room.num}\n\nهل انتهيت من التنظيف وجاهز لبدء الفحص؟`;
            }
            
            document.getElementById('confirm-title').innerText = title;
            document.getElementById('confirm-message').innerHTML = message;
            const btn = document.getElementById('confirm-yes-btn');
            btn.onclick = () => executePhase(id, type);
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }

        // ===============================================
        // == نظام التحقق الذكي للغرف ====================
        // ===============================================
        
        // Smart Search V3 - بحث في 5 طبقات
        function handleRoomSearch(value) {
            appState.searchText = value;
            
            // إخفاء رسائل التحقق إذا كان الحقل فارغاً
            if (!value || value.trim() === '') {
                hideRoomCheckMessages();
                smartUpdate();
                return;
            }
            
            const searchTerm = value.trim().toLowerCase();
            
            // طبقة 1: الغرف النشطة
            const activeMatch = appState.rooms.find(r => 
                String(r.num).toLowerCase().includes(searchTerm) && r.status !== 'scheduled'
            );
            
            // طبقة 2: الطلبات النشطة
            const requestMatch = appState.guestRequests.find(r => 
                String(r.num).toLowerCase().includes(searchTerm) && r.status !== 'scheduled'
            );
            
            // طبقة 3: الصيانة النشطة
            const maintMatch = appState.activeMaintenance.find(m => 
                String(m.num).toLowerCase().includes(searchTerm) && m.status !== 'scheduled'
            );
            
            // طبقة 4: سجل الأمس (آخر 24 ساعة)
            const yesterday = Date.now() - (24 * 60 * 60 * 1000);
            const logMatch = appState.log
                .filter(l => l.finishTime > yesterday)
                .find(l => String(l.num).toLowerCase().includes(searchTerm));
            
            // طبقة 5: الأرشيف (طلبات وصيانة مكتملة)
            const archiveReqMatch = appState.guestRequestsLog
                .find(r => String(r.num).toLowerCase().includes(searchTerm));
            const archiveMaintMatch = appState.completedMaintenanceLog
                .find(m => String(m.num).toLowerCase().includes(searchTerm));
            
            // التحقق الذكي من الغرفة (للرسائل)
            const roomNum = searchTerm;
            const checkResult = checkRoomStatus(roomNum);
            
            // عرض رسائل التحقق
            showRoomCheckMessages(checkResult);
            
            // التحديث العادي (سيقوم smartUpdate بالتصفية)
            smartUpdate();
        }
        
        // دالة التحقق من حالة الغرفة
        function checkRoomStatus(roomNum) {
            const result = {
                num: roomNum,
                isActive: false,
                isCleanedBefore: false,
                hasActiveRequest: false,
                hasCompletedRequest: false,
                lastCleaningDate: null,
                lastRequest: null,
                message: '',
                type: 'info' // error, warning, info, success
            };
            
            // التحقق من الغرف النشطة
            const activeRoom = appState.rooms.find(room => 
                room.num === roomNum && room.status !== 'scheduled'
            );
            
            if (activeRoom) {
                result.isActive = true;
                result.message = `❌ الغرفة ${roomNum} مضافة بالفعل الآن ولا يمكن تكرارها.`;
                result.type = 'error';
                return result;
}

function renderMaintenanceArchive() {

            }
            
            // التحقق من السجل (تم تنظيفها سابقاً)
            const cleaningLog = appState.log
                .filter(item => item.num === roomNum)
                .sort((a, b) => b.id - a.id)[0];
            
            if (cleaningLog) {
                result.isCleanedBefore = true;
                result.lastCleaningDate = new Date(cleaningLog.id);
            }
            
            // التحقق من الطلبات النشطة
            const activeRequest = appState.guestRequests
                .filter(req => req.num === roomNum && req.status !== 'scheduled')
                .sort((a, b) => b.startTime - a.startTime)[0];
            
            if (activeRequest) {
                result.hasActiveRequest = true;
                result.lastRequest = activeRequest;
            }
            
            // التحقق من الطلبات المكتملة
            const completedRequest = appState.guestRequestsLog
                ? appState.guestRequestsLog
                    .filter(req => req.num === roomNum)
                    .sort((a, b) => b.id - a.id)[0]
                : null;
            
            if (completedRequest && !result.hasActiveRequest) {
                result.hasCompletedRequest = true;
                result.lastRequest = completedRequest;
            }
            
            // بناء الرسالة المناسبة
            if (result.hasActiveRequest) {
                const time = new Date(result.lastRequest.startTime);
                const timeStr = time.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let details = result.lastRequest.details || 'طلب';
                if (details.length > 20) {
                    details = details.substring(0, 20) + '...';
                }
                
                result.message = `🔴 آخر طلب: ${details} – ${timeStr}`;
                result.type = 'warning';
                
            } else if (result.hasCompletedRequest) {
                const time = new Date(result.lastRequest.finishTime || result.lastRequest.id);
                const timeStr = time.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let details = result.lastRequest.details || 'طلب';
                if (details.length > 20) {
                    details = details.substring(0, 20) + '...';
                }
                
                result.message = `🛎️ آخر طلب: ${details} – ${timeStr} (تم إغلاقه)`;
                result.type = 'info';
                
            } else if (result.isCleanedBefore) {
                const dateStr = result.lastCleaningDate.toLocaleDateString('ar-EG', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                result.message = `🧹 تم تنظيف هذه الغرفة بتاريخ: ${dateStr}`;
                result.type = 'success';
                
            } else {
                result.message = `✅ الغرفة ${roomNum} جاهزة للإضافة.`;
                result.type = 'info';
            }
            
            return result;
        }
        
        // دالة لعرض رسائل التحقق
        function showRoomCheckMessages(checkResult) {
            const messagesDiv = document.getElementById('room-check-messages');
            const contentDiv = document.getElementById('room-check-content');
            
            if (!messagesDiv || !contentDiv) return;
            
            // تنظيف المحتوى القديم
            contentDiv.innerHTML = '';
            contentDiv.className = '';
            
            // إضافة محتوى جديد
            const messageDiv = document.createElement('div');
            messageDiv.className = `room-check-${checkResult.type}`;
            messageDiv.innerHTML = checkResult.message;
            
            // إضافة تأثير النبض للطلب النشط
            if (checkResult.hasActiveRequest) {
                messageDiv.classList.add('room-check-pulse');
            }
            
            contentDiv.appendChild(messageDiv);
            
            // إضافة زر الإغلاق
            const closeBtn = document.createElement('button');
            closeBtn.className = 'room-check-close';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = hideRoomCheckMessages;
            contentDiv.appendChild(closeBtn);
            
            // عرض الرسائل
            messagesDiv.style.display = 'block';
        }
        
        // دالة لإخفاء رسائل التحقق
        function hideRoomCheckMessages() {
            const messagesDiv = document.getElementById('room-check-messages');
            if (messagesDiv) {
                messagesDiv.style.display = 'none';
            }
        }
        
        // إخفاء الرسائل عند النقر خارجها
        document.addEventListener('click', function(event) {
            const searchContainer = document.querySelector('.search-container');
            const messagesDiv = document.getElementById('room-check-messages');
            
            if (searchContainer && messagesDiv && 
                !searchContainer.contains(event.target) && 
                event.target.id !== 'search-bar') {
                hideRoomCheckMessages();
            }
        });

        // ===============================================
        // == كروت الإحصائيات الجديدة ====================
        // ===============================================
        
        // دالة لتحديث كروت الإحصائيات الجديدة
        function updateNewStats() {
            // تحديث الكروت الأساسية
            document.getElementById('stat-out-done').innerText = appState.log.filter(item => item.type === 'out').length;
            document.getElementById('stat-stay-done').innerText = appState.log.filter(item => item.type === 'stay').length;
            document.getElementById('stat-req-done').innerText = appState.guestRequestsLog ? appState.guestRequestsLog.length : 0;
            document.getElementById('stat-maint-total').innerText = appState.completedMaintenanceLog ? appState.completedMaintenanceLog.length : 0;
            
            // تحديث آخر طلب
            updateLastRequest();
            
            // تحديث آخر صيانة
            updateLastMaintenance();
            
            // تحديث الإحصائيات النشطة
            document.getElementById('stat-active').innerText = appState.rooms.filter(room => room.status !== 'scheduled').length;
            document.getElementById('stat-late').innerText = appState.rooms.filter(room => room.status === 'overdue').length;
        }
        
        // دالة لتحديث آخر طلب
        function updateLastRequest() {
            const lastRequestCard = document.getElementById('stat-last-request-card');
            const lastRequestValue = document.getElementById('stat-last-request');
            
            // البحث عن آخر طلب نشط
            const activeRequests = appState.guestRequests
                .filter(req => req.status !== 'scheduled')
                .sort((a, b) => b.startTime - a.startTime);
            
            if (activeRequests.length > 0) {
                const lastRequest = activeRequests[0];
                const time = new Date(lastRequest.startTime);
                const timeStr = time.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let details = lastRequest.details || 'طلب';
                if (details.length > 8) {
                    details = details.substring(0, 8) + '...';
                }
                
                lastRequestValue.innerText = `${details} - ${timeStr}`;
                
                // إضافة تأثير النبض للطلب النشط
                lastRequestCard.classList.add('pulse-active');
            } else {
                // البحث في سجل الطلبات المكتملة
                const completedRequests = appState.guestRequestsLog || [];
                if (completedRequests.length > 0) {
                    const lastCompleted = completedRequests.sort((a, b) => b.id - a.id)[0];
                    const time = new Date(lastCompleted.finishTime || lastCompleted.id);
                    const timeStr = time.toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    let details = lastCompleted.details || 'طلب';
                    if (details.length > 8) {
                        details = details.substring(0, 8) + '...';
                    }
                    
                    lastRequestValue.innerText = `${details} - ${timeStr}`;
                } else {
                    lastRequestValue.innerText = '--';
                }
                
                // إزالة تأثير النبض
                lastRequestCard.classList.remove('pulse-active');
            }
        }
        
        // دالة لتحديث آخر صيانة
        function updateLastMaintenance() {
            const lastMaintValue = document.getElementById('stat-last-maint');
            
            // البحث عن آخر صيانة نشطة
            const activeMaintenance = appState.activeMaintenance
                .filter(maint => maint.status !== 'scheduled')
                .sort((a, b) => b.startTime - a.startTime);
            
            if (activeMaintenance.length > 0) {
                const lastMaint = activeMaintenance[0];
                const time = new Date(lastMaint.startTime);
                const timeStr = time.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                let details = lastMaint.maintDesc || 'صيانة';
                if (details.length > 8) {
                    details = details.substring(0, 8) + '...';
                }
                
                lastMaintValue.innerText = `${details} - ${timeStr}`;
            } else {
                // البحث في سجل الصيانة المكتملة
                const completedMaintenance = appState.completedMaintenanceLog || [];
                if (completedMaintenance.length > 0) {
                    const lastCompleted = completedMaintenance.sort((a, b) => b.id - a.id)[0];
                    const time = new Date(lastCompleted.finishTime || lastCompleted.id);
                    const timeStr = time.toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    let details = lastCompleted.maintDesc || 'صيانة';
                    if (details.length > 8) {
                        details = details.substring(0, 8) + '...';
                    }
                    
                    lastMaintValue.innerText = `${details} - ${timeStr}`;
                } else {
                    lastMaintValue.innerText = '--';
                }
            }
        }

        // ===============================================
        // == التحديث الذكي للواجهة ======================
        // ===============================================
        
        function smartUpdate() { 
            updateTimersDOM(); 
            updateNewStats(); // استبدل updateStats بـ updateNewStats
            renderRoomCards(); 
            renderGuestRequests();
            renderMaintenanceCards();
        }
        
        function renderRoomCards() {
            const filterItems = (items) => items.filter(item => 
                String(item.num).includes(appState.searchText)
            );
            
            // فصل غرف DND
            let dndRooms = filterItems(appState.rooms.filter(room => room.type === 'dnd'));
            let activeRooms = filterItems(appState.rooms.filter(room => room.status !== 'scheduled' && room.type !== 'dnd')); 
            
            // ترتيب حسب أول عملية "Arrive at Room" - الغرف التي تم الضغط عليها أولاً تظهر أولاً
            activeRooms.sort((a, b) => { 
                // أولاً: حسب وقت بدء العملية (startTime)
                if (a.startTime !== b.startTime) {
                    return a.startTime - b.startTime; // الأقدم أولاً
                }
                // ثانياً: حسب الحالة
                const statusOrder = { 'overdue': 0, 'acknowledging': 1, 'cleaning': 2, 'checking': 3 }; 
                if (statusOrder[a.status] !== statusOrder[b.status]) {
                    return statusOrder[a.status] - statusOrder[b.status]; 
                }
                // ثالثاً: حسب الموعد النهائي
                return (a.deadline - Date.now()) - (b.deadline - Date.now()); 
            });
            
            let scheduledRooms = filterItems(appState.rooms.filter(room => room.status === 'scheduled' && room.type !== 'dnd')); 
            scheduledRooms.sort((a,b) => a.schedTimestamp - b.schedTimestamp);
            
            document.getElementById('rooms-container').innerHTML = activeRooms.length ? 
                activeRooms.map(room => createRoomCard(room)).join('') : 
                '<p style="text-align:center;color:var(--text-sec); font-size:0.85rem;">لا توجد غرف نشطة</p>';
            
            // ============ عرض غرف DND في سطر رفيع ============
            const dndContainer = document.getElementById('dnd-rooms-container');
            if (dndRooms.length > 0) {
                const dndNumbers = dndRooms.map(r => r.num).join(' - ');
                if (dndContainer) {
                    dndContainer.style.display = 'block';
                    dndContainer.innerHTML = `
                        <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; background:linear-gradient(145deg, rgba(100,116,139,0.06), rgba(148,163,184,0.08)); border:1px solid rgba(100,116,139,0.15); border-radius:12px; padding:10px 12px; margin-bottom:10px; font-family:'Tajawal', sans-serif; box-sizing:border-box; width:100%;">
                            <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                                <span style="font-size:1rem; flex-shrink:0;">🚫</span>
                                <span style="font-size:0.8rem; color:#64748b; font-weight:600; flex-shrink:0;">لا تزعج:</span>
                                <span style="font-size:0.85rem; color:#374151; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${dndNumbers}</span>
                            </div>
                            <button onclick="clearDNDRooms()" style="background:linear-gradient(145deg, rgba(239,68,68,0.08), rgba(220,38,38,0.12)); color:#dc2626; border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:5px 10px; font-size:0.75rem; cursor:pointer; font-weight:700; font-family:'Tajawal', sans-serif; white-space:nowrap; flex-shrink:0;">🗑️ حذف</button>
                        </div>
                    `;
                }
            } else {
                if (dndContainer) dndContainer.style.display = 'none';
            }
            
            const schedContainer = document.getElementById('scheduled-rooms-container');
            if(scheduledRooms.length) { 
                schedContainer.style.display = 'block'; 
                schedContainer.innerHTML = 
                    `<div style="font-weight: bold; color: var(--sched-color); margin-bottom: 8px; font-size:0.9rem;">📅 ${t('scheduledRooms')}</div>` + 
                    scheduledRooms.map(room => createRoomCard(room)).join(''); 
            } else { 
                schedContainer.style.display = 'none'; 
            }
        }
        
        function createRoomCard(room) {
            const isScheduled = room.status === 'scheduled'; 
            
            // النصوص
            const checkoutText = t('checkoutCard');
            const stayoverInText = t('stayoverIn');
            const stayoverOutText = t('stayoverOut');
            const badgeText = room.type === 'dnd' ? '🚫 لا تزعج' : 
                            (room.type === 'out' ? checkoutText : 
                            (room.guestStatus === 'in' ? stayoverInText : stayoverOutText)); 

            // زر التراجع
            const undoBtn = !isScheduled && room.undoExpiry && Date.now() < room.undoExpiry ? 
                `<button class="glass-btn undo-btn" style="background:#f1f5f9; color:#64748b; font-size:0.8rem; margin-right:5px;" onclick="undoLastAction('${room.id}')">↩️ تراجع</button>` : ''; 

            // التنبيهات (طلبات/صيانة)
            const roomRequests = appState.guestRequests.filter(r => r.num == room.num && r.status !== 'scheduled');
            const roomMaintenance = appState.activeMaintenance.filter(m => m.num == room.num && m.status !== 'scheduled');
            
            let alertsHtml = '';
            if (roomRequests.length > 0) alertsHtml += ' <span style="color:var(--request-color);">🔔</span>';
            if (roomMaintenance.length > 0) alertsHtml += ' <span style="color:var(--maint-color);">🛠️</span>';

            // الأزرار
            let actionBtn = '';
            if (room.type === 'dnd') {
                actionBtn = `<span style="color:#94a3b8; font-size:0.8rem;">--</span>`;
            } else if (isScheduled) { 
                actionBtn = `<button class="glass-btn start" onclick="forceStartScheduled('${room.id}', 'room')">${t('startNow')}</button>`; 
            } else if (room.status === 'acknowledging') { 
                actionBtn = `<button class="glass-btn start" onclick="promptAction('${room.id}', 'arrival')">${t('arriveRoom')}</button>`; 
            } else if (room.status === 'cleaning') { 
                actionBtn = `<button class="glass-btn" style="background:var(--warning); color:#333;" onclick="promptAction('${room.id}', 'clean')">${t('startInspection')}</button>`; 
            } else if (room.status === 'checking' || room.status === 'overdue') { 
                actionBtn = `<button class="glass-btn finish" onclick="openFinishModal('${room.id}')">${t('finish')}</button>`; 
            }

            // تحديد كلاس الحالة للألوان
            let statusClass = '';
            if (isScheduled) statusClass = 'status-scheduled';
            else if (room.status === 'cleaning') statusClass = 'status-cleaning';
            else if (room.status === 'overdue') statusClass = 'status-over';
            else if (room.type === 'dnd') statusClass = 'status-dnd';

            // Swipe handlers
            const swipeHandlers = `ontouchstart="handleSwipeStart(event, '${room.id}')" ontouchmove="handleSwipeMove(event, '${room.id}')" ontouchend="handleSwipeEnd(event, '${room.id}')"`;

            // --- الهيكلية الجديدة (سطر واحد) - RTL: يمين → يسار ---
            return `
            <div class="room-row ${statusClass}" data-room-id="${room.id}" ${swipeHandlers}>
                
                <div class="room-num-circle">${room.num}</div>

                <div class="room-details">
                    <div class="room-title">${badgeText}${room.isSuperTurbo ? ' 🚀' : ''}</div>
                    <div class="room-timer" id="timer-${room.id}">--</div>
                    ${alertsHtml ? `<div class="room-alerts">${alertsHtml}</div>` : ''}
                </div>

                <div>${actionBtn}${undoBtn}</div>
                
            </div>`;
        }
// ============ Room History Log (سجل تاريخ الغرفة) ============
async function showRoomQuickInfo(id) {
    const room = appState.rooms.find(r => r.id === id);
    if (!room) return;

    hapticFeedback('light');
    
    // جلب تاريخ الغرفة من Firebase
    if (!db) {
        showMiniAlert('⚠️ غير متصل بقاعدة البيانات', 'warning');
        return;
    }
    
    try {
        // البحث في السجلات المحلية أولاً (أسرع)
        const roomNum = room.num;
        const localHistory = [];
        
        // من سجل التنظيف
        const cleaningLogs = appState.log.filter(l => l.num == roomNum).slice(0, 5);
        cleaningLogs.forEach(log => {
            const time = new Date(log.finishTime || log.id);
            localHistory.push({
                type: '🧹 تنظيف',
                time: time.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                status: log.status || 'مكتمل',
                duration: log.duration || '--'
            });
        });
        
        // من سجل الطلبات
        const requestLogs = (appState.guestRequestsLog || []).filter(r => r.num == roomNum).slice(0, 3);
        requestLogs.forEach(req => {
            const time = new Date(req.finishTime || req.id);
            localHistory.push({
                type: '🛎️ طلب',
                time: time.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                status: req.details || 'طلب نزيل',
                duration: '--'
            });
        });
        
        // من سجل الصيانة
        const maintLogs = (appState.completedMaintenanceLog || []).filter(m => m.num == roomNum).slice(0, 3);
        maintLogs.forEach(maint => {
            const time = new Date(maint.finishTime || maint.id);
            localHistory.push({
                type: '🛠️ صيانة',
                time: time.toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                status: maint.maintDesc || 'صيانة',
                duration: maint.duration || '--',
                recurring: maint.recurring || false
            });
        });
        
        // ترتيب حسب الأحدث
        localHistory.sort((a, b) => new Date(b.time) - new Date(a.time));
        
        // ============ Frequent Fault Alert (تنبيه الأعطال المتكررة) ============
        const maintenanceCount = maintLogs.length;
        let frequentFaultAlert = '';
        if (maintenanceCount >= 3) {
            // فحص إذا كان نفس العطل
            const descriptions = maintLogs.map(m => (m.maintDesc || '').toLowerCase());
            const uniqueIssues = [...new Set(descriptions)];
            if (uniqueIssues.length < maintenanceCount) {
                frequentFaultAlert = `<div style="background: rgba(220, 38, 38, 0.1); border: 2px solid var(--danger); border-radius: 8px; padding: 8px; margin-top: 10px;">
                    <strong style="color: var(--danger);">⚠️ تحذير: عطل متكرر!</strong><br>
                    <span style="font-size: 0.85rem;">تم تسجيل ${maintenanceCount} عمليات صيانة لهذه الغرفة</span>
                </div>`;
            }
        }
        
        // ============ Advanced Anti-Cheat (كشف التلاعب) ============
        let antiCheatWarning = '';
        if (room.historyLogs && room.historyLogs.length > 0) {
            const recentLogs = room.historyLogs.slice(-5);
            let suspiciousCount = 0;
            
            recentLogs.forEach(log => {
                if (log.action && log.action.includes('→')) {
                    const parts = log.action.split('→');
                    if (parts.length === 2) {
                        const duration = log.timestamp - (log.prevTimestamp || log.timestamp);
                        const durationMins = Math.floor(duration / 60000);
                        
                        // تحقق من الوقت المنطقي (أقل من دقيقتين مشبوه)
                        if (durationMins < 2 && durationMins > 0) {
                            suspiciousCount++;
                        }
                    }
                }
            });
            
            if (suspiciousCount >= 2) {
                antiCheatWarning = `<div style="background: rgba(245, 158, 11, 0.1); border: 2px solid var(--warning); border-radius: 8px; padding: 8px; margin-top: 10px;">
                    <strong style="color: var(--warning);">⚡ تنبيه: سرعة غير طبيعية</strong><br>
                    <span style="font-size: 0.85rem;">تم اكتشاف ${suspiciousCount} عملية سريعة جداً</span>
                </div>`;
            }
        }
        
        // عرض المعلومات
        const historyHTML = localHistory.length > 0 ? 
            localHistory.slice(0, 10).map(h => `
                <div style="padding: 8px; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                    <strong>${h.type}</strong> - ${h.time}<br>
                    <span style="color: var(--text-sec);">${h.status}</span>
                    ${h.recurring ? ' <span style="color: var(--primary);">🔄 دورية</span>' : ''}
                </div>
            `).join('') : 
            '<p style="text-align: center; color: var(--text-sec); padding: 20px;">لا يوجد سجل سابق</p>';
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.7); 
            display: flex; align-items: center; justify-content: center; 
            z-index: 9999; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: var(--bg-body); border-radius: 16px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="padding: 20px; border-bottom: 2px solid var(--border-color);">
                    <h3 style="margin: 0; color: var(--primary); font-size: 1.3rem;">📋 سجل غرفة ${roomNum}</h3>
                    <p style="margin: 5px 0 0 0; color: var(--text-sec); font-size: 0.9rem;">
                        ${room.type === 'out' ? '🚨 خروج' : '📅 ساكن'} | 
                        ${room.guestStatus === 'in' ? '👤 داخل' : '🚶 خارج'}
                    </p>
                </div>
                ${frequentFaultAlert}
                ${antiCheatWarning}
                <div style="padding: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: var(--text-main); font-size: 1rem;">📊 آخر 10 عمليات</h4>
                    ${historyHTML}
                </div>
                <div style="padding: 15px; border-top: 2px solid var(--border-color);">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                        width: 100%; padding: 12px; background: linear-gradient(135deg, var(--maint-color), #0EA5E9);
                        color: white; border: none; border-radius: 10px; font-size: 1rem; font-weight: 700;
                        cursor: pointer; box-shadow: 0 4px 12px rgba(14,165,233,0.3);
                    ">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Error fetching room history:', error);
        showMiniAlert('❌ خطأ في جلب السجل', 'error');
    }
}

        function createRequestCard(req) {
            const isScheduled = req.status === 'scheduled';
            const details = req.details || 'طلب';
            const shortDetails = details.length > 25 ? details.substring(0, 25) + '...' : details;

            let actionBtn = !isScheduled ? 
                `<button class="glass-btn finish" onclick="completeRequest('${req.id}')">${t('finish')}</button>` : 
                `<button class="glass-btn start" onclick="forceStartScheduled('${req.id}', 'req')">${t('start')}</button>`;

            // RTL: يمين → يسار
            return `
            <div class="room-row status-request ${isScheduled ? 'status-scheduled' : ''}">
                
                <div class="room-num-circle">${req.num}</div>

                <div class="room-details">
                    <div class="room-title">${req.isUrgent ? '🚨 عاجل' : '🛎️ طلب'}</div>
                    <div class="room-timer ${isScheduled ? 'timer-sched' : 'timer-req'}" id="req-timer-${req.id}">0:00</div>
                    <div class="room-desc">${shortDetails}</div>
                </div>

                <div>${actionBtn}</div>
            </div>`;
        }

function renderGuestRequests() {
    const activeReqs = appState.guestRequests.filter(r => r.status !== 'scheduled' && r.status !== 'completed');
    const scheduledReqs = appState.guestRequests.filter(r => r.status === 'scheduled');
    const archiveReqs = appState.guestRequestsLog || [];

    const requestSection = document.getElementById('guest-requests-section');
    const archiveContainer = document.getElementById('req-archive-container');

    const isArchiveOpen = (appState.isArchiveView && appState.isArchiveView.req) === true;

    // قسم الأرشيف لا يظهر إلا إذا كان هناك طلب نشط فقط
        if (activeReqs.length === 0 && scheduledReqs.length === 0) {
        // لا توجد طلبات نشطة - إخفاء القسم بالكامل
        if (requestSection) requestSection.style.display = 'none';
            return;
        } else {
        // يوجد طلبات نشطة - إظهار القسم
        if (requestSection) requestSection.style.display = 'block';
    }

    // عرض الطلبات النشطة
    const activeList = document.getElementById('guest-requests-active-list');
    if (activeList) {
        activeList.innerHTML = activeReqs.length ?
            activeReqs.map(req => createRequestCard(req)).join('') :
            '<p class="no-data">لا توجد طلبات نشطة</p>';
    }

    // عرض الطلبات المجدولة
    const schedContainer = document.getElementById('scheduled-requests-container');
    if (schedContainer) {
        if (scheduledReqs.length) {
            schedContainer.style.display = 'block';
            schedContainer.innerHTML =
                '<div class="section-title">📅 طلبات مجدولة</div>' +
                scheduledReqs.map(req => createRequestCard(req)).join('');
        } else {
            schedContainer.style.display = 'none';
        }
    }

    // ظهور / إخفاء الأرشيف
    if (archiveContainer) {
        archiveContainer.style.display = isArchiveOpen ? 'block' : 'none';
        if (isArchiveOpen) {
            renderGuestRequestsArchive();
        }
    }
}
function renderMaintenanceArchive() {
    const container = document.getElementById('maint-archive-container');
    if (!container) return;

    const maintLog = Array.isArray(appState.completedMaintenanceLog) ? appState.completedMaintenanceLog : [];
    if (maintLog.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-sec);font-size:0.8rem;">لا توجد صيانة مؤرشفة</p>';
        return;
    }

    const limit = appState.archiveViewLimit?.maint || 10;
    const visible = maintLog.slice(0, limit);
    container.innerHTML = visible.map(item => createLogRow(item, true)).join('');
    const btnMore = document.getElementById('btn-more-maint');
    if (btnMore) btnMore.style.display = maintLog.length > limit ? 'block' : 'none';
}

// ===============================================
// == دالة renderMaintenanceCards الكاملة =========
// ===============================================
function renderMaintenanceCards() {
    const filterItems = (items) => items.filter(item => 
        String(item.num).includes(appState.searchText)
    );
    
    let activeMaint = filterItems(appState.activeMaintenance.filter(m => m.status !== 'scheduled' && m.status !== 'completed'));
    let scheduledMaint = filterItems(appState.activeMaintenance.filter(m => m.status === 'scheduled')); 
    scheduledMaint.sort((a,b) => a.schedTimestamp - b.schedTimestamp);
    
    const maintenanceSection = document.getElementById('maintenance-section');
    
    // قسم الأرشيف لا يظهر إلا إذا كان هناك صيانة نشطة فقط
    if (activeMaint.length === 0 && scheduledMaint.length === 0) {
        // لا توجد صيانة نشطة - إخفاء القسم بالكامل
        if (maintenanceSection) maintenanceSection.style.display = 'none';
        return;
    } else {
        // يوجد صيانة نشطة - إظهار القسم
        if (maintenanceSection) maintenanceSection.style.display = 'block';
    }
    
    const activeList = document.getElementById('maintenance-active-list');
    if (activeList) {
        activeList.innerHTML = activeMaint.length ? 
        activeMaint.map(m => createMaintenanceCard(m)).join('') : 
        '<p style="text-align:center;color:var(--text-sec);font-size:0.8rem;">لا توجد صيانة نشطة</p>';
    }
    
    const schedMaintContainer = document.getElementById('scheduled-maintenance-container');
    if(schedMaintContainer) {
    if(scheduledMaint.length) { 
        schedMaintContainer.style.display = 'block'; 
        schedMaintContainer.innerHTML = 
            '<div style="font-weight: bold; color: var(--sched-color); margin-bottom: 8px; font-size:0.9rem;">📅 صيانة مجدولة</div>' + 
            scheduledMaint.map(m => createMaintenanceCard(m)).join(''); 
    } else { 
        schedMaintContainer.style.display = 'none'; 
        }
    }

    // تحديث أرشيف الصيانة
const maintArchiveContainer = document.getElementById('maint-archive-container');
const isMaintArchiveOpen = appState.isArchiveView && appState.isArchiveView.maint;

if (maintArchiveContainer) {
    maintArchiveContainer.style.display = isMaintArchiveOpen ? 'block' : 'none';

    if (isMaintArchiveOpen) {
        const maintLog = (appState.completedMaintenanceLog || [])
            .filter(item => String(item.num).includes(appState.searchText || ''))
            .sort((a, b) => b.id - a.id);

        if (maintLog.length === 0) {
            maintArchiveContainer.innerHTML =
                '<p style="text-align:center;color:var(--text-sec);font-size:0.7rem;">الأرشيف فارغ</p>';
            const btnMoreMaint = document.getElementById('btn-more-maint');
            if (btnMoreMaint) btnMoreMaint.style.display = 'none';
        } else {
            const limit = appState.archiveViewLimit?.maint || 10;
            const visible = maintLog.slice(0, limit);
            maintArchiveContainer.innerHTML = visible.map(item => createLogRow(item, true)).join('');
            const btnMoreMaint = document.getElementById('btn-more-maint');
            if (btnMoreMaint) btnMoreMaint.style.display = maintLog.length > limit ? 'block' : 'none';
            }
        }
    }
}
        
        function createMaintenanceCard(maint) {
            const isScheduled = maint.status === 'scheduled';
            const shortDesc = maint.maintDesc.length > 25 ? maint.maintDesc.substring(0, 25) + '...' : maint.maintDesc;
            
            let actionBtn = !isScheduled ? 
                `<button class="glass-btn finish" onclick="openCompleteMaintenanceModal('${maint.id}')">${t('finish')}</button>` : 
                `<button class="glass-btn start" onclick="forceStartScheduled('${maint.id}', 'maint')">${t('start')}</button>`;
            
            let imgBtn = (maint.maintImg && !isScheduled) ? 
                `<a href="${maint.maintImg}" target="_blank" style="font-size:0.8rem; margin-right:5px;">📷</a>` : '';

            // RTL: يمين → يسار
            return `
            <div class="room-row status-maintenance ${isScheduled ? 'status-scheduled' : ''}">
                
                <div class="room-num-circle">${maint.num}</div>

                <div class="room-details">
                    <div class="room-title">🛠️ صيانة</div>
                    <div class="room-timer ${isScheduled ? 'timer-sched' : 'timer-maint'}" id="maint-timer-${maint.id}">0:00</div>
                    <div class="room-desc">${shortDesc}</div>
                </div>

                <div style="display:flex; align-items:center;">${actionBtn}${imgBtn}</div>
            </div>`;
        }
        
        function renderLogSection() { 
            const listEl = document.getElementById('cleaning-log-list'); 
            const btnMore = document.getElementById('btn-more-log');
            
            if (!appState.log || appState.log.length === 0) { 
                listEl.innerHTML = '<p style="text-align:center;color:var(--text-sec); font-size:0.85rem;">لا توجد عمليات مكتملة</p>'; 
                if (btnMore) btnMore.style.display = 'none';
                return; 
            } 
            
            const sortedLog = [...appState.log].sort((a, b) => b.id - a.id);
            // عرض آخر 3 سجلات فقط افتراضياً
            const defaultLimit = 3;
            const limit = appState.logViewLimit || defaultLimit;
            const visibleLogs = sortedLog.slice(0, limit); 
            
            listEl.innerHTML = visibleLogs.map(item => createLogRow(item, false)).join(''); 
            
            if (btnMore) {
                btnMore.style.display = sortedLog.length > limit ? 'block' : 'none';
                btnMore.textContent = `📂 عرض المزيد (${sortedLog.length - limit} سجل)`;
            }
        }
        
        function createLogRow(item, isArchive) {
            // تحديد نوع العملية والألوان
            let borderColor = 'var(--success)';
            let bgColor = 'rgba(34, 197, 94, 0.05)';
            let typeIcon = '🧹';
            let typeText = 'تنظيف';
            let statusBadge = 'مكتمل ✅';
            
            if (item.type === 'request' || item.details) {
                borderColor = 'var(--request-color)';
                bgColor = 'rgba(59, 130, 246, 0.05)';
                typeIcon = '🛎️';
                typeText = 'طلب';
                statusBadge = 'تم التنفيذ ✅';
            } else if (item.type === 'maint' || item.maintDesc) {
                borderColor = 'var(--maint-color)';
                bgColor = 'rgba(6, 182, 212, 0.05)';
                typeIcon = '🛠️';
                typeText = 'صيانة';
                statusBadge = item.finishImg ? 'تمت الصيانة ✅' : 'قيد الصيانة 🔧';
            } else if (item.type === 'out') {
                typeText = 'خروج';
            } else if (item.type === 'stay') {
                typeText = 'ساكن';
            }
            
            if (item.isLate) {
                statusBadge = 'متأخر ⚠️';
            }
            
            // الأوقات
            const startTime = item.startTime ? new Date(item.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';
            const finishTime = item.finishTime ? new Date(item.finishTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }) : new Date(item.id).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
            const duration = item.duration || '--';
            
            // التفاصيل المختصرة
            let shortDetails = '';
            if (item.details) {
                shortDetails = item.details.split(' ')[0] || '';
            } else if (item.maintDesc) {
                shortDetails = item.maintDesc.split(' ')[0] || '';
            }
            
            // أيقونة الصورة
            let imgIcon = '';
            if (item.finishImg || item.maintImg) {
                const imgUrl = item.finishImg || item.maintImg;
                imgIcon = `<span onclick="window.open('${imgUrl}', '_blank')" style="cursor:pointer; font-size:1.1rem; margin-right:8px;" title="عرض الصورة">📷</span>`;
            }
            
            return `<div style="border-right:4px solid ${borderColor}; padding:12px 14px; background:linear-gradient(135deg, ${bgColor}, rgba(255,255,255,0.95)); border-radius:12px; margin-bottom:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); font-family:'Tajawal', sans-serif;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="font-size:1.2rem; font-weight:900; color:${borderColor}; background:rgba(0,0,0,0.05); padding:6px 12px; border-radius:8px; min-width:45px; text-align:center;">
                            ${item.num}
                        </div>
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <span style="font-size:0.9rem; font-weight:700; color:#1f2937;">${typeIcon} ${typeText}${shortDetails ? ': ' + shortDetails : ''}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center;">
                        ${imgIcon}
                        <span style="font-size:0.75rem; padding:4px 10px; border-radius:20px; background:linear-gradient(135deg, ${borderColor}, ${borderColor}dd); color:white; font-weight:700;">${statusBadge}</span>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid rgba(0,0,0,0.05);">
                    <div style="display:flex; flex-direction:column; gap:3px; font-size:0.8rem; color:#6b7280;">
                        <span>🕒 البدء: <strong style="color:#374151;">${startTime}</strong></span>
                        <span>🕒 الانتهاء: <strong style="color:#374151;">${finishTime}</strong></span>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem; color:#9ca3af;">الوقت المستغرق</div>
                        <div style="font-size:1rem; font-weight:800; color:${borderColor};">⏱️ ${duration}</div>
                    </div>
                </div>
            </div>`;
        }
        
        function updateTimersDOM() { 
            const now = Date.now(); 
            
            // Room Timers + Update Undo Buttons
            appState.rooms.forEach(room => { 
                const el = document.getElementById(`timer-${room.id}`); 
                if (!el) return; 
                
                // تحديث مؤقت التراجع (15 ثانية) - يعد تنازلياً
                if (room.undoExpiry && Date.now() < room.undoExpiry) {
                    const undoLeft = Math.max(0, Math.ceil((room.undoExpiry - Date.now())/1000));
                    const undoTimeEl = document.getElementById(`undo-time-${room.id}`);
                    if (undoTimeEl) {
                        undoTimeEl.textContent = undoLeft;
                    }
                    if (undoLeft <= 0) {
                        const undoBtn = document.getElementById(`undo-btn-${room.id}`);
                        if (undoBtn) undoBtn.remove();
                        // إزالة undoExpiry من قاعدة البيانات
                        db.collection('rooms').doc(room.id).set({ undoExpiry: null }, { merge: true }).catch(e => console.error(e));
                    }
                } 
                
                if (room.status === 'scheduled' && room.schedTimestamp) { 
                    const diff = room.schedTimestamp - now;
                    if (diff > 0) {
                        const m = Math.floor(diff / 60000);
                        const s = Math.floor((diff % 60000) / 1000);
                        const timeStr = new Date(room.schedTimestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        el.innerHTML = `<div style="font-size:0.9rem; font-weight:bold;">${m}:${s.toString().padStart(2, '0')}</div>
                                       <div style="font-size:0.6rem; color:var(--text-sec);">⏰ ${timeStr}</div>`;
                        el.className = 'room-timer timer-sched';
                    } else {
                        el.innerHTML = '<div style="color:var(--success); font-weight:bold;">بدء الآن</div>';
                    }
                } else { 
                    const diff = room.deadline - now; 
                    const m = Math.floor(Math.abs(diff) / 60000); 
                    const s = Math.floor((Math.abs(diff) % 60000) / 1000); 
                    el.innerHTML = `${diff < 0 ? '+' : ''}${m}:${s.toString().padStart(2, '0')}`; 
                    el.className = `room-timer ${diff < 0 ? 'timer-danger' : 'timer-active'}`; 
                    
                    if (diff < 0 && room.status !== 'overdue') { 
                        db.collection('rooms').doc(room.id).set({ status: 'overdue' }, { merge: true }).catch(e => console.error(e)); 
                    }
                } 
            }); 
            
            // Maintenance Timers
            appState.activeMaintenance.forEach(maint => { 
                const el = document.getElementById(`maint-timer-${maint.id}`); 
                if (!el) return; 
                
                if (maint.status === 'scheduled' && maint.schedTimestamp) { 
                    const diff = maint.schedTimestamp - now;
                    if (diff > 0) {
                        const m = Math.floor(diff / 60000);
                        const s = Math.floor((diff % 60000) / 1000);
                        const timeStr = new Date(maint.schedTimestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        el.innerHTML = `<div style="font-size:0.9rem; font-weight:bold;">${m}:${s.toString().padStart(2, '0')}</div>
                                       <div style="font-size:0.6rem; color:var(--text-sec);">⏰ ${timeStr}</div>`;
                        el.className = 'room-timer timer-sched';
                    } else {
                        el.innerHTML = '<div style="color:var(--success); font-weight:bold;">بدء الآن</div>';
                    }
                } else { 
                    const diff = now - maint.startTime; 
                    const h = Math.floor(diff / 3600000); 
                    const m = Math.floor((diff % 3600000) / 60000); 
                    const s = Math.floor((diff % 60000) / 1000); 
                    el.innerHTML = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; 
                } 
            }); 
            
            // Guest Request Timers
            appState.guestRequests.forEach(req => { 
                const el = document.getElementById(`req-timer-${req.id}`); 
                if (!el) return; 
                
                if (req.status === 'scheduled' && req.schedTimestamp) { 
                    const diff = req.schedTimestamp - now;
                    if (diff > 0) {
                        const m = Math.floor(diff / 60000);
                        const s = Math.floor((diff % 60000) / 1000);
                        const timeStr = new Date(req.schedTimestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                        el.innerHTML = `<div style="font-size:0.9rem; font-weight:bold;">${m}:${s.toString().padStart(2, '0')}</div>
                                       <div style="font-size:0.6rem; color:var(--text-sec);">⏰ ${timeStr}</div>`;
                        el.className = 'room-timer timer-sched';
                    } else {
                        el.innerHTML = '<div style="color:var(--success); font-weight:bold;">بدء الآن</div>';
                    }
                } else { 
                    const diff = now - req.startTime; 
                    const h = Math.floor(diff / 3600000); 
                    const m = Math.floor((diff % 3600000) / 60000); 
                    const s = Math.floor((diff % 60000) / 1000); 
                    el.innerHTML = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; 
                    el.className = 'timer-display timer-req'; 
                } 
            }); 
        }

        // ===============================================
        // == العمليات الأساسية (Firebase) ===============
        // ===============================================
        
        async function saveData() {
            if (!db) return;
            toggleSyncIndicator(true);
            try {
                await db.collection('settings').doc('globalState').set({
                    turbo: appState.turbo,
                    archiveViewLimit: appState.archiveViewLimit,
                    logViewLimit: appState.logViewLimit,
                    logStep: appState.logStep,
                    points: appState.points
                }, { merge: true });
            } catch (e) { 
                console.error("Error saving global state:", e); 
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        function toggleSyncIndicator(show) {
            const el = document.getElementById('sync-indicator');
            if (el) el.style.display = show ? 'block' : 'none';
        }
        
        // ============ نظام رفع الصور الذكي (Smart Upload + Retry) ============
        async function uploadToImgBB(file, retries = 3) { 
            return new Promise((resolve) => { 
                if (!file) return resolve(null);
                
                const reader = new FileReader(); 
                reader.onload = function(e) { 
                    const img = new Image(); 
                    img.onload = function() { 
                        // ============ ضغط الصور الذكي (Smart Compression) ============
                        const canvas = document.createElement('canvas'); 
                        const ctx = canvas.getContext('2d'); 
                        
                        // تحديد الحد الأقصى: 1000px بدلاً من 800px لجودة أفضل
                        const maxDim = 1000;
                        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
                        canvas.width = img.width * scale; 
                        canvas.height = img.height * scale; 
                        
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                        
                        // ضغط الصورة بنسبة 70% (أفضل من 80%)
                        canvas.toBlob(async function(blob) { 
                            const originalSize = (file.size / 1024).toFixed(0);
                            const compressedSize = (blob.size / 1024).toFixed(0);
                            console.log(`📸 ضغط الصورة: ${originalSize}KB → ${compressedSize}KB`);
                            
                            const formData = new FormData(); 
                            formData.append('image', blob); 
                            
                            // ============ نظام إعادة المحاولة (Retry System) ============
                            let attempt = 0;
                            let uploadSuccess = false;
                            let finalUrl = null;
                            
                            while (attempt < retries && !uploadSuccess) {
                                attempt++;
                                
                                try {
                                    if (attempt > 1) {
                                        showMiniAlert(`🔄 محاولة ${attempt}/${retries}...`, 'warning');
                                        await new Promise(r => setTimeout(r, 1000 * attempt)); // تأخير تصاعدي
                                    }
                                    
                                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${HOTEL_CONFIG.imgbbKey}`, { 
                                method: 'POST', 
                                        body: formData,
                                        signal: AbortSignal.timeout(15000) // 15 ثانية timeout
                                    });
                                    
                                    if (!response.ok) {
                                        throw new Error(`HTTP ${response.status}`);
                                    }
                                    
                                    const data = await response.json();
                                    
                                    if (data.data?.url) {
                                        finalUrl = data.data.url;
                                        uploadSuccess = true;
                                        showMiniAlert('✅ تم رفع الصورة بنجاح', 'success');
                                    } else {
                                        throw new Error('No URL in response');
                                    }
                                    
                                } catch (error) {
                                    console.error(`❌ محاولة ${attempt} فشلت:`, error.message);
                                    
                                    if (attempt === retries) {
                                        showMiniAlert('❌ فشل رفع الصورة بعد 3 محاولات', 'error');
                                    }
                                }
                            }
                            
                            resolve(finalUrl);
                        }, 'image/jpeg', 0.7); 
                    }; 
                    
                    img.onerror = function() {
                        showMiniAlert('❌ خطأ في قراءة الصورة', 'error');
                        resolve(null);
                    };
                    
                    img.src = e.target.result; 
                }; 
                
                reader.onerror = function() {
                    showMiniAlert('❌ خطأ في قراءة الملف', 'error');
                    resolve(null);
                };
                
                reader.readAsDataURL(file); 
            }); 
        }
        
        async function submitNewEntryToFirebase(mode, num, isScheduled, schedTimestamp, fullTimeString, roomType, isSuper, maintDetails, reqDetails, maintFile) {
            if (!db) return;
            
            toggleSyncIndicator(true);
            try {
                let imgUrl = null;
                if (mode === 'maintenance' && maintFile) {
                    imgUrl = await uploadToImgBB(maintFile);
                    if (!imgUrl) { 
                        showMiniAlert('فشل رفع صورة الصيانة.', 'error'); 
                        return; 
                    }
                }
                
                if (mode === 'request') {
                    const newRequest = { 
                        num, 
                        details: reqDetails, 
                        schedTime: isImmediateRequest ? "🚨 فوري" : fullTimeString, 
                        schedTimestamp, 
                        isUrgent: isImmediateRequest, 
                        startTime: Date.now(), 
                        status: isImmediateRequest ? 'active' : 'scheduled',
                        type: 'request'
                    };
                    await db.collection('guestRequests').doc().set(newRequest, { merge: true });
                    
                } else if (mode === 'maintenance') {
                    const newMaint = { 
                        num, 
                        maintDesc: maintDetails, 
                        maintImg: imgUrl, 
                        schedTime: isImmediateMaint ? "🚨 فوري" : fullTimeString, 
                        schedTimestamp, 
                        startTime: Date.now(), 
                        status: isImmediateMaint ? 'active' : 'scheduled', 
                        history: [{
                            action: 'تسجيل', 
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) 
                        }],
                        type: 'maint'
                    };
                    await db.collection('activeMaintenance').doc().set(newMaint, { merge: true });
                    
                } else if (mode === 'cleaning') {
                    const newRoom = { 
                        num, 
                        type: roomType, 
                        status: isScheduled ? 'scheduled' : 'acknowledging', 
                        startTime: Date.now(), 
                        deadline: Date.now() + HOTEL_CONFIG.times.TRAVEL, 
                        guestStatus: roomType === 'stay' ? document.getElementById('inpGuestStatus').value : 'out', 
                        undoExpiry: Date.now() + 15000, 
                        historyLogs: [{ 
                            action: 'إضافة', 
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) 
                        }], 
                        isSuperTurbo: isSuper, 
                        schedTime: fullTimeString, 
                        schedTimestamp 
                    };
                    await db.collection('rooms').doc().set(newRoom, { merge: true });
                }
                
                toggleSyncIndicator(false);
                showMiniAlert('✅ تم الإضافة بنجاح', 'success');
                playNotificationSound();
                
            } catch(e) { 
                console.error("Firebase Add Failed:", e); 
                showMiniAlert(`❌ فشل الإضافة.`, 'error'); 
                toggleSyncIndicator(false);
            }
        }
        
        async function addNewBtnAction() {
            let num = document.getElementById('inpRoomNum').value; 
            
            if (!num) { 
                showMiniAlert('⚠️ أدخل رقم الغرفة.', 'warning'); 
                return; 
            }
            if (num < 1 || num > 9999) { 
                showMiniAlert('⚠️ رقم غرفة غير صحيح.', 'warning'); 
                return; 
            }
            
            num = String(num); 
            
            if (currentAddMode === 'cleaning' && appState.rooms.find(room => room.num === num)) { 
                showMiniAlert(`❌ الغرفة ${num} نشطة بالفعل. لا يمكن إضافة تنظيف جديد.`, 'error'); 
                return; 
            }
            
            if (!db) { 
                showMiniAlert('❌ خطأ في الاتصال بقاعدة البيانات.', 'error'); 
                return; 
            }
            
            let timeValue = '';
            let schedTimestamp = null;
            let timeInputId = '';
            
            if (currentAddMode === 'cleaning') { 
                timeInputId = 'systemTimeInput'; 
            } else if (currentAddMode === 'request' && !isImmediateRequest) { 
                timeInputId = 'systemTimeInputReq'; 
            } else if (currentAddMode === 'maintenance' && !isImmediateMaint) { 
                timeInputId = 'systemTimeInputMaint'; 
            }
            
            if (timeInputId) { 
                timeValue = document.getElementById(timeInputId).value; 
            }
            
            const timeParts = timeValue.split(':');
            const hours = parseInt(timeParts[0]) || 12;
            const minutes = parseInt(timeParts[1]) || 0;
            const period = hours >= 12 ? 'م' : 'ص';
            const displayHours = hours % 12 || 12;
            const fullTimeString = `اليوم - ${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
            
            const isScheduled = (currentAddMode === 'request' && !isImmediateRequest) || 
                              (currentAddMode === 'maintenance' && !isImmediateMaint) || 
                              (currentAddMode === 'cleaning' && document.getElementById('inpRoomType').value === 'stay');
            
            if (isScheduled) { 
                const now = new Date(); 
                const selected = new Date(); 
                selected.setHours(hours, minutes, 0, 0); 
                if (selected < new Date(now.getTime() - 60000)) { 
                    showMiniAlert("⚠️ الوقت المجدول في الماضي!", "warning"); 
                    return; 
                } 
                schedTimestamp = selected.getTime(); 
            }
            
            // رسائل واتساب مختلفة حسب النوع
            let waMsg = '';
            const currentDate = new Date().toLocaleDateString('ar-EG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            if (currentAddMode === 'request') {
                const details = document.getElementById('inpRequestDetails').value; 
                if (!details) { 
                    showMiniAlert('⚠️ اكتب تفاصيل الطلب.', 'warning'); 
                    return; 
                }
                
                if (isImmediateRequest) {
                    waMsg = `🚨 *طلب عاجل - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `📝 التفاصيل: ${details}\n` +
                           `⏰ الحالة: عاجل - تنفيذ الآن\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `🕒 الوقت: ${currentTime}\n` +
                           `👤 مسجل الطلب: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#طلب_عاجل`;
                } else {
                    waMsg = `📅 *طلب مجدول - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `📝 التفاصيل: ${details}\n` +
                           `⏰ وقت التنفيذ: ${fullTimeString}\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `👤 مسجل الطلب: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#طلب_مجدول`;
                }
                       
            } else if (currentAddMode === 'maintenance') {
                const details = document.getElementById('inpMaintDetails').value; 
                if (!details) { 
                    showMiniAlert('⚠️ اكتب وصف العطل.', 'warning'); 
                    return; 
                }
                
                if (isImmediateMaint) {
                    waMsg = `🚨 *صيانة عاجلة - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `🔧 نوع العطل: ${details}\n` +
                           `⏰ الحالة: عاجلة - تدخل فوري\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `🕒 الوقت: ${currentTime}\n` +
                           `👤 مسجل البلاغ: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#صيانة_عاجلة`;
                } else {
                    waMsg = `📅 *صيانة مجدولة - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `🔧 نوع العطل: ${details}\n` +
                           `⏰ وقت التنفيذ: ${fullTimeString}\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `👤 مسجل البلاغ: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#صيانة_مجدولة`;
                }
                       
            } else if (currentAddMode === 'cleaning') {
                const type = document.getElementById('inpRoomType').value; 
                if (!type) { 
                    showMiniAlert('⚠️ اختر حالة الغرفة.', 'warning'); 
                    return; 
                }
                const guestStatus = document.getElementById('inpGuestStatus').value;
                const isSuper = document.getElementById('inpSuperTurbo').checked;
                
                if (type === 'out') {
                    waMsg = `🚨 *تنظيف عاجل (خروج) - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `⚠️ الحالة: النزيل غادر - تنظيف عاجل\n` +
                           `⚡ النظام: ${isSuper ? 'سوبر تيربو (خصم 5 دقائق)' : appState.turbo ? 'تيربو نشط' : 'عادي'}\n` +
                           `⏰ المطلوب: التنظيف الآن (فوري)\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `🕒 الوقت: ${currentTime}\n` +
                           `👤 المشرف: فريق النظافة\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#تنظيف_عاجل`;
                } else {
                    waMsg = `📅 *تنظيف مجدول (ساكن) - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${num}\n` +
                           `👤 حالة النزيل: ${guestStatus === 'in' ? 'داخل الغرفة' : 'خارج الغرفة'}\n` +
                           `⚡ النظام: ${isSuper ? 'سوبر تيربو (خصم 5 دقائق)' : appState.turbo ? 'تيربو نشط' : 'عادي'}\n` +
                           `⏰ وقت التنظيف: ${fullTimeString}\n` +
                           `📅 التاريخ: ${currentDate}\n` +
                           `👤 المشرف: فريق النظافة\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#تنظيف_مجدول`;
                }
            }
            
            if (waMsg) {
                window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank'); 
            }
            
            closeModal(); 
            
            const roomType = document.getElementById('inpRoomType').value;
            const isSuper = document.getElementById('inpSuperTurbo').checked;
            const maintDetails = document.getElementById('inpMaintDetails').value;
            const reqDetails = document.getElementById('inpRequestDetails').value;
            const maintFile = document.getElementById('inpMaintImage').files[0];
            
            await submitNewEntryToFirebase(currentAddMode, num, isScheduled, schedTimestamp, 
                                          fullTimeString, roomType, isSuper, maintDetails, 
                                          reqDetails, maintFile);
            
            // إضافة نقاط
            if (currentAddMode === 'cleaning') {
                addPoints(5, 'إضافة غرفة');
            } else if (currentAddMode === 'request') {
                addPoints(3, 'إضافة طلب');
            } else if (currentAddMode === 'maintenance') {
                addPoints(5, 'إضافة صيانة');
            }
        }
        
        async function confirmFinishRoom() { 
            if (!db) { 
                showMiniAlert("❌ خطأ: قاعدة البيانات غير متصلة", "error"); 
                return; 
            }
            
            const room = appState.rooms.find(r => r.id === activeRoomId); 
            if (!room) { 
                showMiniAlert("❌ خطأ: الغرفة غير موجودة", "error"); 
                return; 
            }
            
            const status = document.getElementById('modal-notes').value; 
            const isLate = document.getElementById('delay-reason-section').style.display !== 'none'; 
            const delayReason = document.getElementById('modal-delay').value; 
            const shouldSendWhatsapp = document.getElementById('inpSendWhatsapp').checked; 
            
            if (isLate && (!delayReason || delayReason === '')) { 
                showMiniAlert('⚠️ يجب اختيار سبب التأخير قبل التأكيد!', 'warning'); 
                return; 
            } 
            
            const repairDetails = document.getElementById('repair-details-input').value;
            const repairFile = document.getElementById('modal-img-camera-input').files[0];
            
            // Guard: منع إنهاء "جاهزة" إذا يوجد بيانات صيانة
            if (status === 'جاهزة' && (repairDetails || repairFile)) {
                showMiniAlert('❌ لا يمكن الإنهاء كـ "جاهزة" مع وجود بيانات صيانة. امسح بيانات الصيانة أو اختر "صيانة".', 'error'); 
                return;
            }
            
            // Guard: إلزام بيانات الصيانة الكاملة
            if (status === 'تحتاج صيانة' && (!repairDetails || !repairFile)) {
                showMiniAlert('❌ الصيانة تتطلب وصف المشكلة وصورة.', 'error'); 
                return;
            }
            
            // Guard: منع إنهاء "جاهزة" إذا متأخرة والسبب فارغ
            if (status === 'جاهزة' && isLate && (!delayReason || delayReason === '')) {
                showMiniAlert('⚠️ يجب اختيار سبب التأخير قبل التأكيد!', 'warning'); 
                return;
            }
            
            if (shouldSendWhatsapp) {
                const currentDate = new Date().toLocaleDateString('ar-EG', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                let waMsg = '';
                if (status === 'تحتاج صيانة') {
                    waMsg = `🛠️ *تقرير صيانة - منظومة Adora*\n` +
                           `🏨 ${HOTEL_CONFIG.name}\n` +
                           `🔢 الغرفة: ${room.num}\n` +
                           `⚠️ الحالة: تحتاج صيانة\n` +
                           `📝 وصف العطل: ${repairDetails}\n` +
                           `⏰ الحالة: ${isLate ? 'متأخرة' : 'في الوقت المحدد'}\n` +
                           `${isLate ? `🔴 سبب التأخير: ${delayReason}\n` : ''}` +
                           `📅 تاريخ الإنهاء: ${currentDate}\n` +
                           `🕒 وقت الإنهاء: ${currentTime}\n` +
                           `👤 مسؤول الإنهاء: فريق العمل\n` +
                           `➖➖➖➖➖➖➖➖➖➖\n` +
                           `#صيانة`;

                } else {
                    if (isLate) {
                        const delayMinutes = Math.floor((Date.now() - room.deadline) / 60000);
                        waMsg = `⏰ *تقرير إنهاء (متأخر) - منظومة Adora*\n` +
                               `🏨 ${HOTEL_CONFIG.name}\n` +
                               `🔢 الغرفة: ${room.num}\n` +
                               `✅ الحالة: جاهزة للتسليم\n` +
                               `⚠️ التأخير: ${delayMinutes} دقيقة\n` +
                               `🔴 سبب التأخير: ${delayReason}\n` +
                               `📅 تاريخ الإنهاء: ${currentDate}\n` +
                               `🕒 وقت الإنهاء: ${currentTime}\n` +
                               `👤 مسؤول الإنهاء: فريق العمل\n` +
                               `➖➖➖➖➖➖➖➖➖➖\n` +
                               `#إنهاء_متأخر`;
                    } else {
                        waMsg = `✅ *تقرير إنهاء - منظومة Adora*\n` +
                               `🏨 ${HOTEL_CONFIG.name}\n` +
                               `🔢 الغرفة: ${room.num}\n` +
                               `✅ الحالة: جاهزة للتسليم\n` +
                               `⭐ الأداء: في الوقت المحدد\n` +
                               `📅 تاريخ الإنهاء: ${currentDate}\n` +
                               `🕒 وقت الإنهاء: ${currentTime}\n` +
                               `👤 مسؤول الإنهاء: فريق العمل\n` +
                               `➖➖➖➖➖➖➖➖➖➖\n` +
                               `#إنهاء_ناجح`;
                    }
                }
                
                if (waMsg) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank'); 
                }
            }
            
            toggleSyncIndicator(true);
            let imgUrl = null;
            
            try {
                if (status !== 'جاهزة' && repairFile) {
                    imgUrl = await uploadToImgBB(repairFile);
                }
                
                if (status === 'تحتاج صيانة') {
                    // إضافة إلى قائمة الصيانة
                    const newMaint = {
                        num: room.num,
                        maintDesc: repairDetails,
                        maintImg: imgUrl,
                        startTime: Date.now(),
                        status: 'active',
                        history: [{
                            action: 'تحويل من التنظيف',
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                        }]
                    };
                    await db.collection('activeMaintenance').doc().set(newMaint, { merge: true });
                }
                
                // إنشاء سجل التنظيف
                const duration = Date.now() - room.startTime;
                const durationMinutes = Math.floor(duration / 60000);
                const durationSeconds = Math.floor((duration % 60000) / 1000);
                
                const logEntry = {
                    num: room.num,
                    type: room.type,
                    startTime: room.startTime,  // وقت البدء
                    finishTime: Date.now(),
                    duration: `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`,
                    status: status,
                    isLate: isLate,
                    delayReason: isLate ? delayReason : null,
                    id: Date.now(),
                    guestStatus: room.guestStatus,
                    isSuperTurbo: room.isSuperTurbo,
                    maintDesc: status !== 'جاهزة' ? repairDetails : null,
                    finishImg: status !== 'جاهزة' ? imgUrl : null
                };
                
                // استخدام Batch لضمان النزاهة الذرية
                const batch = db.batch();
                const logRef = db.collection('log').doc();
                batch.set(logRef, logEntry, { merge: true });
                
                // حذف الغرفة من القائمة النشطة
                const roomRef = db.collection('rooms').doc(activeRoomId);
                batch.delete(roomRef);
                
                await batch.commit();
                
                // حساب النقاط
                let pointsEarned = 0;
                let pointsReason = '';
                
                if (isLate) {
                    pointsEarned = pointsSystem.late;
                    pointsReason = 'إنهاء متأخر';
                } else {
                    if (room.isSuperTurbo) {
                        pointsEarned = pointsSystem.superTurbo;
                        pointsReason = 'سوبر تيربو';
                    } else {
                        pointsEarned = pointsSystem.onTime;
                        pointsReason = 'إنهاء في الوقت';
                    }
                }
                
                addPoints(pointsEarned, pointsReason);
                
                closeModal();
                showMiniAlert(`✅ تم إنهاء غرفة ${room.num}`, 'success');
                showMotivationBar();
                playNotificationSound();
                
            } catch(e) {
                console.error("Error finishing room:", e);
                showMiniAlert('❌ فشل إنهاء الغرفة', 'error');
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        async function confirmCompleteMaintenance() {
            hapticFeedback('heavy');
            
            if (!db) { 
                showMiniAlert("❌ خطأ: قاعدة البيانات غير متصلة", "error"); 
                return; 
            }
            
            const maint = appState.activeMaintenance.find(m => m.id === activeMaintId); 
            if (!maint) { 
                showMiniAlert("❌ خطأ: الصيانة غير موجودة", "error"); 
                return; 
            }
            
            // التحقق من رفع الصورة (إجباري)
                const file = document.getElementById('maint-img-camera-input').files[0];
            if (!file) {
                showMiniAlert("⚠️ يجب رفع صورة للصيانة", "error");
                return;
            }
            
            toggleSyncIndicator(true);
            try {
                let imgUrl = await uploadToImgBB(file);
                
                const finishTime = Date.now();
                const duration = finishTime - maint.startTime;
                const durationHours = Math.floor(duration / 3600000);
                const durationMinutes = Math.floor((duration % 3600000) / 60000);
                
                // إنشاء سجل الصيانة المكتملة
                const completedEntry = {
                    num: maint.num,
                    maintDesc: maint.maintDesc,
                    startTime: maint.startTime,
                    finishTime: finishTime,
                    duration: `${durationHours}:${durationMinutes.toString().padStart(2, '0')}`,
                    finishImg: imgUrl,
                    originalMaintImg: maint.maintImg,
                    id: Date.now()
                };
                
                // استخدام Batch لضمان النزاهة الذرية
                const batch = db.batch();
                const completedRef = db.collection('completedMaintenanceLog').doc();
                batch.set(completedRef, completedEntry, { merge: true });
                
                // حذف من الصيانة النشطة - استخدام id الصحيح
                const maintRef = db.collection('activeMaintenance').doc(String(activeMaintId));
                batch.delete(maintRef);
                
                await batch.commit();
                
                // تحديث الواجهة مباشرة
                smartUpdate();
                
                // إضافة النقاط
                addPoints(pointsSystem.maintenanceComplete, 'إكمال صيانة');
                
                // إرسال تقرير واتساب
                const currentDate = new Date().toLocaleDateString('ar-EG', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                const waMsg = `✅ *تقرير إنهاء صيانة - منظومة Adora*\n` +
                             `🏨 ${HOTEL_CONFIG.name}\n` +
                             `🔢 الغرفة: ${maint.num}\n` +
                             `🔧 نوع الصيانة: ${maint.maintDesc}\n` +
                             `⏰ المدة: ${durationHours} ساعة و ${durationMinutes} دقيقة\n` +
                             `📅 تاريخ الإنهاء: ${currentDate}\n` +
                             `🕒 وقت الإنهاء: ${currentTime}\n` +
                             `👤 مسؤول الإنهاء: فريق الصيانة\n` +
                             `➖➖➖➖➖➖➖➖➖➖\n` +
                             `#صيانة_مكتملة`;
                
                window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank');
                
                closeModal();
                showMiniAlert(`✅ تم إنهاء صيانة غرفة ${maint.num}`, 'success');
                playNotificationSound();
                
            } catch(e) {
                console.error("Error completing maintenance:", e);
                showMiniAlert('❌ فشل إنهاء الصيانة', 'error');
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        async function executePhase(id, type) {
            const room = appState.rooms.find(r => r.id === id);
            if (!room) return;
            
            closeModal();
            toggleSyncIndicator(true);
            
            try {
                const now = Date.now();
                const newHistoryLog = {
                    action: type === 'arrival' ? 'الوصول للغرفة' : 'بدء الفحص',
                    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                };
                
                let updateData = {
                    historyLogs: firebase.firestore.FieldValue.arrayUnion(newHistoryLog)
                };
                
                // زر التراجع فقط لأول عملية (arrival) وليس لـ clean
                if (type === 'arrival') {
                    updateData.undoExpiry = now + 15000;
                    let baseTime = room.isSuperTurbo ? 
                        (room.type === 'out' ? HOTEL_CONFIG.times.OUT_TURBO : HOTEL_CONFIG.times.STAY_TURBO) :
                        (room.type === 'out' ? HOTEL_CONFIG.times.OUT_NORM : HOTEL_CONFIG.times.STAY_NORM);
                    
                    // التيربو يخصم 5 دقائق
                    if (appState.turbo) {
                        baseTime -= 5 * 60000; // خصم 5 دقائق
                    }
                    // وضع التركيز يزيد 5 دقائق
                    if (appState.focusMode) {
                        baseTime += 5 * 60000; // إضافة 5 دقائق
                    }
                    
                    updateData.status = 'cleaning';
                    updateData.deadline = now + baseTime;
                    
                } else if (type === 'clean') {
                    // لا يوجد undoExpiry هنا - زر التراجع فقط لأول عملية
                    let checkingTime = HOTEL_CONFIG.times.CHECKING;
                    
                    // التيربو يخصم 5 دقائق
                    if (appState.turbo) {
                        checkingTime -= 5 * 60000;
                    }
                    // وضع التركيز يزيد 5 دقائق
                    if (appState.focusMode) {
                        checkingTime += 5 * 60000;
                    }
                    
                    updateData.status = 'checking';
                    updateData.deadline = now + checkingTime;
                }
                
                    await db.collection('rooms').doc(id).set(updateData, { merge: true });
                
                showMiniAlert(`✅ ${type === 'arrival' ? 'تم الوصول للغرفة' : 'تم بدء الفحص'}`, 'success');
                addPoints(2, type === 'arrival' ? 'الوصول للغرفة' : 'بدء الفحص');
                
            } catch(e) {
                console.error("Error executing phase:", e);
                showMiniAlert('❌ فشل تحديث الحالة', 'error');
            } finally {
                toggleSyncIndicator(false);
            }
        }
        
        async         function undoLastAction(id) {
            hapticFeedback('medium');
            
            const room = appState.rooms.find(r => r.id === id);
            if (!room || !room.undoExpiry || Date.now() > room.undoExpiry) return;
            
            // Guard: منع التراجع من صيانة إذا يوجد بيانات صيانة
            const hasMaintenance = appState.activeMaintenance.some(m => m.num == room.num);
            if (hasMaintenance) {
                showMiniAlert('⚠️ Cannot undo: Room has active maintenance. Clear maintenance first.', 'warning');
                return;
            }
            
            pendingAction = 'undo';
            tempRoomId = id;
            
            document.getElementById('confirm-message').innerText = `Do you want to undo the last action for room ${room.num}?`;
            document.getElementById('confirm-yes-btn').onclick = async function() {
                toggleSyncIndicator(true);
                try {
                    // State Flow Protection: مسار حياة الغرفة الإجباري
                    let newStatus = 'acknowledging';
                    let newDeadline = Date.now() + HOTEL_CONFIG.times.TRAVEL;
                    
                    if (room.status === 'cleaning') {
                        newStatus = 'acknowledging';
                    } else if (room.status === 'checking' || room.status === 'overdue') {
                        newStatus = 'cleaning';
                        const baseTime = room.isSuperTurbo ? 
                            (room.type === 'out' ? HOTEL_CONFIG.times.OUT_TURBO : HOTEL_CONFIG.times.STAY_TURBO) :
                            (room.type === 'out' ? HOTEL_CONFIG.times.OUT_NORM : HOTEL_CONFIG.times.STAY_NORM);
                        newDeadline = Date.now() + baseTime;
                    }
                    
                    await db.collection('rooms').doc(id).set({
                        status: newStatus,
                        deadline: newDeadline,
                        undoExpiry: null
                    }, { merge: true });
                    
                    showMiniAlert(`↩️ Undone last action`, 'success');
                    addPoints(-2, 'Undo action');
                    
                } catch(e) {
                    console.error("Error undoing action:", e);
                    showMiniAlert('❌ Failed to undo', 'error');
                } finally {
                    toggleSyncIndicator(false);
                    closeModal();
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
        
        async function forceStartScheduled(id, type) {
            pendingAction = 'forceStart';
            tempRoomId = id;
            
            let itemName = '';
            if (type === 'room') {
                const room = appState.rooms.find(r => r.id === id);
                itemName = `غرفة ${room?.num || ''}`;
            } else if (type === 'req') {
                const req = appState.guestRequests.find(r => r.id === id);
                itemName = `طلب غرفة ${req?.num || ''}`;
            } else if (type === 'maint') {
                const maint = appState.activeMaintenance.find(m => m.id === id);
                itemName = `صيانة غرفة ${maint?.num || ''}`;
            }
            
            document.getElementById('confirm-message').innerText = `هل تريد بدء ${itemName} الآن؟`;
            document.getElementById('confirm-yes-btn').onclick = async function() {
                toggleSyncIndicator(true);
                try {
                    if (type === 'room') {
                        await db.collection('rooms').doc(id).update({
                            status: 'acknowledging',
                            deadline: Date.now() + HOTEL_CONFIG.times.TRAVEL,
                            schedTime: null,
                            schedTimestamp: null
                        });
                    } else if (type === 'req') {
                        await db.collection('guestRequests').doc(id).update({
                            status: 'active',
                            schedTime: null,
                            schedTimestamp: null
                        });
                    } else if (type === 'maint') {
                        await db.collection('activeMaintenance').doc(id).update({
                            status: 'active',
                            schedTime: null,
                            schedTimestamp: null
                        });
                    }
                    
                    showMiniAlert(`✅ تم بدء ${itemName}`, 'success');
                    addPoints(3, 'بدء مجدول الآن');
                    
                } catch(e) {
                    console.error("Error forcing start:", e);
                    showMiniAlert('❌ فشل بدء العنصر', 'error');
                } finally {
                    toggleSyncIndicator(false);
                    closeModal();
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
        
        async function completeRequest(id) {
            const req = appState.guestRequests.find(r => r.id === id);
            if (!req) {
                showMiniAlert('❌ الطلب غير موجود', 'error');
                return;
            }
            
            pendingAction = 'completeRequest';
            tempRoomId = id;
            
            document.getElementById('confirm-message').innerText = t('requestConfirm').replace('{room}', req.num);
            document.getElementById('confirm-yes-btn').onclick = async function() {
                closeModal(); // إغلاق فوري
                toggleSyncIndicator(true);
                try {
                    const now = Date.now();
                    const duration = now - (req.startTime || now);
                    const durationMinutes = Math.floor(duration / 60000);
                    const durationSeconds = Math.floor((duration % 60000) / 1000);
                    
                    // حفظ في سجل الطلبات
                    const logEntry = {
                        num: req.num,
                        details: req.details,
                        startTime: req.startTime,  // وقت البدء
                        duration: `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`,
                        finishTime: now,
                        isUrgent: req.isUrgent || false,
                        type: 'request',
                        id: now
                    };
                    
                    // استخدام Batch لضمان النزاهة الذرية
                    const batch = db.batch();
                    const logRef = db.collection('guestRequestsLog').doc();
                    batch.set(logRef, logEntry, { merge: true });
                    
                    // حذف من الطلبات النشطة - استخدام id الصحيح
                    const reqRef = db.collection('guestRequests').doc(String(id));
                    batch.delete(reqRef);
                    
                    await batch.commit();
                    
                    // تحديث الواجهة مباشرة
                    smartUpdate();
                    
                    // إضافة النقاط
                    const points = req.isUrgent ? pointsSystem.urgentRequest : pointsSystem.onTime;
                    addPoints(points, req.isUrgent ? 'طلب عاجل' : 'طلب عادي');
                    
                    // إرسال تقرير واتساب
                    const currentDate = new Date().toLocaleDateString('ar-EG', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    
                    const waMsg = `✅ *تقرير إنهاء طلب - منظومة Adora*\n` +
                                 `🏨 ${HOTEL_CONFIG.name}\n` +
                                 `🔢 الغرفة: ${req.num}\n` +
                                 `📝 تفاصيل الطلب: ${req.details}\n` +
                                 `⏰ المدة: ${durationMinutes} دقيقة و ${durationSeconds} ثانية\n` +
                                 `🚨 الحالة: ${req.isUrgent ? 'عاجل' : 'عادي'}\n` +
                                 `📅 تاريخ الإنهاء: ${currentDate}\n` +
                                 `🕒 وقت الإنهاء: ${currentTime}\n` +
                                 `👤 مسؤول الإنهاء: فريق العمل\n` +
                                 `➖➖➖➖➖➖➖➖➖➖\n` +
                                 `#طلب_مكتمل`;
                    
                    window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank');
                    
                    showMiniAlert(`✅ تم إنهاء طلب غرفة ${req.num}`, 'success');
                    playNotificationSound();
                    
                } catch(e) {
                    console.error("Error completing request:", e);
                    showMiniAlert('❌ فشل إنهاء الطلب', 'error');
                } finally {
                    toggleSyncIndicator(false);
                    closeModal();
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
        
        function checkPasswordAndAction() {
            const entered = document.getElementById('admin-password').value;
            const hash = simpleHash(entered);
            
            if (hash === HOTEL_CONFIG.adminHash) {
                closeModal();
                
                if (pendingAction === 'clearLog') {
                    clearLogAction();
                } else if (pendingAction === 'newShift') {
                    newShiftAction();
                } else if (pendingAction === 'clearPurchases') {
                    // تم التعامل معه بالفعل
                }
            } else {
                showMiniAlert('❌ كلمة المرور غير صحيحة', 'error');
            }
        }
        
        async function clearLogAction() {
            pendingAction = 'confirmClearLog';
            
            document.getElementById('confirm-message').innerText = 'هل تريد مسح سجل اليوم بالكامل؟ لا يمكن التراجع عن هذا الإجراء.';
            document.getElementById('confirm-yes-btn').onclick = async function() {
                toggleSyncIndicator(true);
                try {
                    // حذف جميع السجلات من Firebase
                    const batch = db.batch();
                    
                    // حذف سجل التنظيف
                    const logSnapshot = await db.collection('log').get();
                    logSnapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    
                    // حذف سجل الطلبات
                    const reqLogSnapshot = await db.collection('guestRequestsLog').get();
                    reqLogSnapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    
                    // حذف سجل الصيانة المكتملة
                    const maintLogSnapshot = await db.collection('completedMaintenanceLog').get();
                    maintLogSnapshot.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    
                    await batch.commit();
                    
                    showMiniAlert('🗑️ تم مسح السجل بالكامل', 'success');
                    addPoints(-10, 'مسح السجل');
                    
                } catch(e) {
                    console.error("Error clearing log:", e);
                    showMiniAlert('❌ فشل مسح السجل', 'error');
                } finally {
                    toggleSyncIndicator(false);
                    closeModal();
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
        
        async function newShiftAction() {
            pendingAction = 'confirmNewShift';
            
            const activeRooms = appState.rooms.filter(r => r.status !== 'scheduled').length;
            const activeRequests = appState.guestRequests.filter(r => r.status !== 'scheduled').length;
            const activeMaintenance = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            
            let message = 'هل تريد بدء شفت جديد؟\n\n';
            message += `🧹 غرف نشطة: ${activeRooms}\n`;
            message += `🛎️ طلبات نشطة: ${activeRequests}\n`;
            message += `🛠️ صيانة نشطة: ${activeMaintenance}\n\n`;
            message += 'سيتم نقل جميع المهام النشطة إلى الأرشيف.';
            
            document.getElementById('confirm-message').innerText = message;
            document.getElementById('confirm-yes-btn').onclick = async function() {
                toggleSyncIndicator(true);
                try {
                    const now = Date.now();
                    const batch = db.batch();
                    
                    // أرشفة الغرف النشطة
                    const roomsSnapshot = await db.collection('rooms').where('status', '!=', 'scheduled').get();
                    roomsSnapshot.forEach(doc => {
                        const room = doc.data();
                        const logEntry = {
                            num: room.num,
                            type: room.type,
                            finishTime: now,
                            status: 'ملغاة - بداية شفت جديد',
                            isLate: true,
                            id: now + Math.random(),
                            guestStatus: room.guestStatus,
                            isSuperTurbo: room.isSuperTurbo
                        };
                        
                        // إضافة إلى السجل
                        const logRef = db.collection('log').doc();
                        batch.set(logRef, logEntry, { merge: true });
                        // حذف من النشطة
                        batch.delete(doc.ref);
                    });
                    
                    // أرشفة الطلبات النشطة
                    const requestsSnapshot = await db.collection('guestRequests').where('status', '!=', 'scheduled').get();
                    requestsSnapshot.forEach(doc => {
                        const req = doc.data();
                        const logEntry = {
                            num: req.num,
                            details: req.details,
                            finishTime: now,
                            isUrgent: req.isUrgent,
                            status: 'ملغاة - بداية شفت جديد',
                            id: now + Math.random()
                        };
                        
                        // إضافة إلى سجل الطلبات
                        const reqLogRef = db.collection('guestRequestsLog').doc();
                        batch.set(reqLogRef, logEntry, { merge: true });
                        // حذف من النشطة
                        batch.delete(doc.ref);
                    });
                    
                    // أرشفة الصيانة النشطة
                    const maintenanceSnapshot = await db.collection('activeMaintenance').where('status', '!=', 'scheduled').get();
                    maintenanceSnapshot.forEach(doc => {
                        const maint = doc.data();
                        const logEntry = {
                            num: maint.num,
                            maintDesc: maint.maintDesc,
                            finishTime: now,
                            status: 'ملغاة - بداية شفت جديد',
                            id: now + Math.random()
                        };
                        
                        // إضافة إلى سجل الصيانة
                        const maintLogRef = db.collection('completedMaintenanceLog').doc();
                        batch.set(maintLogRef, logEntry, { merge: true });
                        // حذف من النشطة
                        batch.delete(doc.ref);
                    });
                    
                    await batch.commit();
                    
                    // إنشاء تقرير الشفت
                    const currentDate = new Date().toLocaleDateString('ar-EG', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    
                    const waMsg = `🌅 *بداية شفت جديد - منظومة Adora*\n` +
                                 `🏨 ${HOTEL_CONFIG.name}\n` +
                                 `📅 التاريخ: ${currentDate}\n` +
                                 `🕒 الوقت: ${currentTime}\n` +
                                 `📊 إحصائيات الشفت السابق:\n` +
                                 `   🧹 غرف أرشفة: ${activeRooms}\n` +
                                 `   🛎️ طلبات أرشفة: ${activeRequests}\n` +
                                 `   🛠️ صيانة أرشفة: ${activeMaintenance}\n` +
                                 `➖➖➖➖➖➖➖➖➖➖\n` +
                                 `🔥 بداية شفت جديد - جاهز للعمل!\n` +
                                 `➖➖➖➖➖➖➖➖➖➖\n` +
                                 `👤 المشرف: فريق العمل\n` +
                                 `#بداية_شفت`;
                    
                    window.open(`https://wa.me/?text=${encodeURIComponent(waMsg)}`, '_blank');
                    
                    showMiniAlert('🌅 تم بدء شفت جديد بنجاح', 'success');
                    addPoints(20, 'بداية شفت جديد');
                    showMotivationBar();
                    
                } catch(e) {
                    console.error("Error starting new shift:", e);
                    showMiniAlert('❌ فشل بدء الشفت الجديد', 'error');
                } finally {
                    toggleSyncIndicator(false);
                    closeModal();
                }
            };
            
            document.getElementById('action-confirm-modal').style.display = 'flex';
        }
        
        function generateDailyReport() {
            const outDone = appState.log.filter(item => item.type === 'out').length;
            const stayDone = appState.log.filter(item => item.type === 'stay').length;
            const reqDone = appState.guestRequestsLog ? appState.guestRequestsLog.length : 0;
            const maintDone = appState.completedMaintenanceLog ? appState.completedMaintenanceLog.length : 0;
            const activeRooms = appState.rooms.filter(r => r.status !== 'scheduled').length;
            const lateRooms = appState.rooms.filter(r => r.status === 'overdue').length;
            const activeRequests = appState.guestRequests.filter(r => r.status !== 'scheduled').length;
            const activeMaintenance = appState.activeMaintenance.filter(m => m.status !== 'scheduled').length;
            
            const currentDate = new Date().toLocaleDateString('ar-EG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const currentTime = new Date().toLocaleTimeString('ar-EG', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            let report = `📊 *تقرير المدير - منظومة Adora*\n\n` +
                        `🏨 *الفندق:* ${HOTEL_CONFIG.name}\n` +
                        `📅 *التاريخ:* ${currentDate}\n` +
                        `🕐 *الوقت:* ${currentTime}\n` +
                        `━━━━━━━━━━━━━━━━━\n\n` +
                        `📈 *الإنجازات:*\n` +
                        `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
                        `🚪 خروج: *${outDone}* غرفة\n` +
                        `🏠 ساكن: *${stayDone}* غرفة\n` +
                        `🛎️ طلبات: *${reqDone}* طلب\n` +
                        `🔧 صيانة: *${maintDone}* إصلاح\n` +
                        `━━━━━━━━━━━━━━━━━\n\n` +
                        `📊 *الحالة الحالية:*\n` +
                        `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
                        `🟢 نشط: *${activeRooms}* غرفة\n` +
                        `🔴 متأخر: *${lateRooms}* غرفة\n` +
                        `🚨 طلبات عاجلة: *${activeRequests}* طلب\n` +
                        `🛠️ صيانة نشطة: *${activeMaintenance}* إصلاح\n` +
                        `🏆 النقاط: *${appState.points}*\n` +
                        `━━━━━━━━━━━━━━━━━\n\n` +
                        `⭐ *التقييم:* ${getPerformanceRating(outDone + stayDone)}\n` +
                        `━━━━━━━━━━━━━━━━━\n\n` +
                        `👤 *مقدم التقرير:* المدير\n\n` +
                        `#تقرير_المدير`;
            
            window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
            showMiniAlert('📊 تم إنشاء تقرير المدير', 'success');
            addPoints(15, 'تقرير المدير');
        }
        
        function getPerformanceRating(totalCompleted) {
            if (totalCompleted >= 20) return 'ممتاز ⭐⭐⭐⭐⭐';
            if (totalCompleted >= 15) return 'جيد جداً ⭐⭐⭐⭐';
            if (totalCompleted >= 10) return 'جيد ⭐⭐⭐';
            if (totalCompleted >= 5) return 'مقبول ⭐⭐';
            return 'ضعيف ⭐';
        }
        
        // ===============================================
        // == استماع Firebase في الوقت الحقيقي ===========
        // ===============================================
        
        function setupFirebaseListeners() {
            if (!db) return;
            
            // استماع للغرف
            db.collection('rooms').onSnapshot(snapshot => {
                appState.rooms = [];
                snapshot.forEach(doc => {
                    appState.rooms.push({ id: doc.id, ...doc.data() });
                });
                smartUpdate();
            }, error => {
                console.error("Rooms listener error:", error);
            });
            
            // استماع للسجل
            db.collection('log').onSnapshot(snapshot => {
                appState.log = [];
                snapshot.forEach(doc => {
                    appState.log.push({ id: doc.id, ...doc.data() });
                });
                renderLogSection();
                updateNewStats();
            }, error => {
                console.error("Log listener error:", error);
            });
            
            // استماع للصيانة النشطة
            db.collection('activeMaintenance').onSnapshot(snapshot => {
                appState.activeMaintenance = [];
                snapshot.forEach(doc => {
                    appState.activeMaintenance.push({ id: doc.id, ...doc.data() });
                });
                smartUpdate();
            }, error => {
                console.error("Maintenance listener error:", error);
            });
            
            // استماع للصيانة المكتملة
            db.collection('completedMaintenanceLog').onSnapshot(snapshot => {
                appState.completedMaintenanceLog = [];
                snapshot.forEach(doc => {
                    appState.completedMaintenanceLog.push({ id: doc.id, ...doc.data() });
                });
                smartUpdate();
            }, error => {
                console.error("Completed maintenance listener error:", error);
            });
            
            // استماع للطلبات النشطة
            db.collection('guestRequests').onSnapshot(snapshot => {
                appState.guestRequests = [];
                snapshot.forEach(doc => {
                    appState.guestRequests.push({ id: doc.id, ...doc.data() });
                });
                renderGuestRequests(); // تحديث مباشر للطلبات
                smartUpdate();
            }, error => {
                console.error("Guest requests listener error:", error);
            });
            
            // استماع لسجل الطلبات
            db.collection('guestRequestsLog').onSnapshot(snapshot => {
                appState.guestRequestsLog = [];
                snapshot.forEach(doc => {
                    appState.guestRequestsLog.push({ id: doc.id, ...doc.data() });
                });
                smartUpdate();
            }, error => {
                console.error("Guest requests log listener error:", error);
            });
            
            // استماع للإعدادات العامة
            db.collection('settings').doc('globalState').onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    appState.turbo = data.turbo || false;
                    appState.archiveViewLimit = data.archiveViewLimit || { req: 5, maint: 5 };
                    appState.logViewLimit = data.logViewLimit || 3;
                    appState.logStep = data.logStep || 3;
                    appState.points = data.points || 0;
                    
                    document.getElementById('turbo-mode-btn').classList.toggle('turbo-active', appState.turbo);
                    updatePointsDisplay();
                }
            }, error => {
                console.error("Settings listener error:", error);
            });
        }
        
        // ===============================================
        // == تهيئة التطبيق =============================
        // ===============================================
        
        function initApp() {
            // تهيئة اللغة
            initLanguage();
            
            // تحميل النقاط
            loadPoints();
            
            // تحميل قائمة المشتريات
            loadPurchasesFromStorage();
            
            // إعداد مستمعي Firebase
            setupFirebaseListeners();
            
            // تحديث المؤقتات كل ثانية
            setInterval(updateTimersDOM, 1000);
            
            // تحديث الإحصائيات كل 30 ثانية
            setInterval(updateNewStats, 30000);
            
            // فحص الصيانة الدورية كل ساعة
            setInterval(checkRecurringMaintenance, 60 * 60 * 1000);
            checkRecurringMaintenance(); // فحص فوري عند البدء
            
            // ============ Anti-Idle Detection (كشف الخمول) ============
            let lastActivityTime = Date.now();
            let idleWarningShown = false;
            
            // تسجيل النشاط
            ['touchstart', 'click', 'scroll', 'keypress'].forEach(eventType => {
                document.addEventListener(eventType, () => {
                    lastActivityTime = Date.now();
                    idleWarningShown = false;
                });
            });
            
            // فحص الخمول كل دقيقة
            setInterval(() => {
                const idleTime = Date.now() - lastActivityTime;
                const idleMinutes = Math.floor(idleTime / 60000);
                
                // تحذير بعد 10 دقائق خمول
                if (idleMinutes >= 10 && !idleWarningShown && appState.rooms.length > 0) {
                    showMiniAlert('⚠️ تنبيه: لا يوجد نشاط منذ 10 دقائق', 'warning');
                    hapticFeedback('heavy');
                    idleWarningShown = true;
                    
                    // تسجيل الخمول في السجل
                    console.log(`⏸️ Idle detected: ${idleMinutes} minutes`);
                }
                
                // تحديث مؤشر الخمول في الواجهة
                const idleIndicator = document.getElementById('idle-indicator');
                if (idleIndicator) {
                    if (idleMinutes >= 5) {
                        idleIndicator.style.display = 'block';
                        idleIndicator.innerText = `⏸️ خامل: ${idleMinutes} د`;
                    } else {
                        idleIndicator.style.display = 'none';
                    }
                }
            }, 60000); // كل دقيقة
            
            // تطبيق الثيم الديناميكي عند البدء (تم تعطيله مؤقتاً)
            // applyDynamicTheme();
            
            // تحديث الثيم كل ساعة
            // setInterval(applyDynamicTheme, 60 * 60 * 1000);
            
            // ============ التقرير الآلي الساعة 8 مساءً (Auto Report 8PM) ============
            setInterval(() => {
                const now = new Date();
                const hour = now.getHours();
                const minute = now.getMinutes();
                
                // إذا كانت الساعة 8:00 مساءً (20:00)
                if (hour === 20 && minute === 0) {
                    // التحقق من أننا لم نرسل تقرير اليوم
                    const lastReportDate = localStorage.getItem('lastAutoReportDate');
                    const today = now.toDateString();
                    
                    if (lastReportDate !== today) {
                        sendAutoReport8PM();
                        localStorage.setItem('lastAutoReportDate', today);
                    }
                }
            }, 60000); // فحص كل دقيقة
            
            // عرض رسالة ترحيبية
            setTimeout(() => {
                showMiniAlert('🏨 مرحباً بك في منظومة Adora', 'success');
                showMotivationBar();
            }, 1000);
            
            // إعداد أحداث الكاميرا
            setupCameraEvents();
            
            // جعل التطبيق متاحاً كتطبيق PWA
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').catch(err => {
                        console.log('ServiceWorker registration failed: ', err);
                    });
                });
            }
            
            // منع التحديث العرضي
            window.addEventListener('beforeunload', (e) => {
                if (appState.rooms.length > 0 || appState.guestRequests.length > 0 || appState.activeMaintenance.length > 0) {
                    e.preventDefault();
                    e.returnValue = 'لديك مهام نشطة. هل تريد حقاً مغادرة الصفحة؟';
                }
            });
        }
        
        function setupCameraEvents() {
            // كاميرا الصيانة في المودال
            const modalCameraBtn = document.getElementById('modal-img-camera-input');
            if (modalCameraBtn) {
                modalCameraBtn.addEventListener('change', function(e) {
                    if (e.target.files && e.target.files[0]) {
                        showMiniAlert('📷 تم اختيار صورة', 'success');
                    }
                });
            }
            
            // كاميرا الصيانة العامة
            const maintCameraBtn = document.getElementById('maint-img-camera-input');
            if (maintCameraBtn) {
                maintCameraBtn.addEventListener('change', function(e) {
                    if (e.target.files && e.target.files[0]) {
                        showMiniAlert('📷 تم اختيار صورة', 'success');
                    }
                });
            }
            
            // كاميرا إضافة الصيانة
            const inpMaintImage = document.getElementById('inpMaintImage');
            if (inpMaintImage) {
                inpMaintImage.addEventListener('change', function(e) {
                    if (e.target.files && e.target.files[0]) {
                        showMiniAlert('📷 تم اختيار صورة الصيانة', 'success');
                    }
                });
            }
            
            // ============ Recurring Maintenance (الصيانة الدورية) ============
            const recurringCheckbox = document.getElementById('inpRecurringMaint');
            const recurringOptions = document.getElementById('recurringOptions');
            if (recurringCheckbox && recurringOptions) {
                recurringCheckbox.addEventListener('change', function() {
                    recurringOptions.style.display = this.checked ? 'block' : 'none';
                });
            }
        }
        
        // فحص الصيانة الدورية وإنشاء مهام جديدة
        function checkRecurringMaintenance() {
            if (!db) return;
            
            const completedMaint = appState.completedMaintenanceLog || [];
            const today = Date.now();
            
            completedMaint.forEach(maint => {
                if (maint.recurring && maint.recurringDays) {
                    const nextDue = maint.finishTime + (maint.recurringDays * 24 * 60 * 60 * 1000);
                    
                    // إذا حان موعد الصيانة الدورية
                    if (today >= nextDue) {
                        // التحقق من عدم وجود صيانة نشطة لنفس الغرفة
                        const existingMaint = appState.activeMaintenance.find(m => 
                            m.num == maint.num && m.maintDesc === maint.maintDesc
                        );
                        
                        if (!existingMaint) {
                            // إنشاء صيانة دورية جديدة
                            const newMaint = {
                                id: Date.now(),
                                num: maint.num,
                                maintDesc: `🔄 ${maint.maintDesc}`,
                                status: 'scheduled',
                                schedTimestamp: today,
                                recurring: true,
                                recurringDays: maint.recurringDays,
                                startTime: today
                            };
                            
                            appState.activeMaintenance.push(newMaint);
                            
                            // حفظ في Firebase
                            db.collection('activeMaintenance').doc(String(newMaint.id)).set(newMaint, {merge: true})
                                .then(() => {
                                    showMiniAlert(`🔄 صيانة دورية: غرفة ${maint.num}`, 'info');
                                    smartUpdate();
                                });
                        }
                    }
                }
            });
        }
        
        // ===============================================
        // == بدء التطبيق ===============================
        // ===============================================
        
        window.onload = initApp;
        
        // إضافة event listener لزر الإضافة السريع
        document.addEventListener('keydown', function(e) {
            // Ctrl + N لفتح نافذة الإضافة
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                openAddModal();
            }
            
            // Esc لإغلاق جميع النوافذ
            if (e.key === 'Escape') {
                closeAllModals();
            }
            
            // مسافة لإظهار التقرير السريع
            if (e.key === ' ' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                showQuickReport();
            }
        });
        
        // جعل التطبيق متجاوباً مع اللمس
        document.addEventListener('touchstart', function() {}, {passive: true});
        
        // دعم وضع الشاشة الكاملة
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }
        
        // التحكم في وضع التركيز - يزيد المؤقتات 5 دقائق
        function toggleFocusMode() {
            hapticFeedback('medium');
            
            appState.focusMode = !appState.focusMode;
            document.body.classList.toggle('focus-mode', appState.focusMode);
            
            const btn = document.getElementById('focus-mode-btn');
            if (btn) {
                btn.classList.toggle('focus-active', appState.focusMode);
            }
            
            showMiniAlert(appState.focusMode ? '👁️ وضع التركيز مفعّل (+5 دقائق)' : '👁️ تم إلغاء وضع التركيز', 'success');
        }
        
        // زر التيربو - تلقائياً مفعّل - يخصم 5 دقائق
        function toggleTurboMode() {
            hapticFeedback('medium');
            
            appState.turbo = !appState.turbo;
            const btn = document.getElementById('turbo-mode-btn');
            if (btn) {
                btn.classList.toggle('turbo-active', appState.turbo);
                btn.style.color = appState.turbo ? 'var(--success)' : '';
            }
            
            const msg = appState.language === 'ar' ? 
                (appState.turbo ? '⚡ وضع التيربو مفعل (-5 دقائق)' : '⚡ وضع التيربو معطل') :
                (appState.turbo ? '⚡ Turbo mode enabled (-5 min)' : '⚡ Turbo mode disabled');
            showMiniAlert(msg, 'success');
            if (appState.turbo) playNotificationSound();
        }
        
        // تهيئة اللغة عند بدء التطبيق
        function initLanguage() {
            const savedLang = localStorage.getItem('adora_lang') || 'ar';
            appState.language = savedLang;
            document.documentElement.lang = savedLang;
            document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr';
            document.body.classList.toggle('rtl-mode', savedLang === 'ar');
            document.body.classList.toggle('ltr-mode', savedLang === 'en');
            
            // تحديث الواجهة فوراً
            setTimeout(() => updateUIForLanguage(), 100);
        }
        
        // Language toggle - تبديل اللغة فعلي
        function toggleLanguage() {
            appState.language = appState.language === 'en' ? 'ar' : 'en';
            localStorage.setItem('adora_lang', appState.language);
            document.documentElement.lang = appState.language;
            document.documentElement.dir = appState.language === 'ar' ? 'rtl' : 'ltr';
            document.body.classList.toggle('rtl-mode', appState.language === 'ar');
            document.body.classList.toggle('ltr-mode', appState.language === 'en');
            
            // تحديث الواجهة
            updateUIForLanguage();
            showMiniAlert(appState.language === 'ar' ? '🌐 تم التبديل للعربية' : '🌐 Switched to English', 'success');
        }
        
        function updateUIForLanguage() {
            const lang = appState.language;
            
            // تحديث زر اللغة
            const langBtn = document.getElementById('lang-btn');
            if (langBtn) langBtn.textContent = lang === 'ar' ? '🌐 EN' : '🌐 AR';
            
            // تحديث عناوين الأقسام
            document.querySelectorAll('.sec-title span').forEach((el, i) => {
                if (i === 0) el.innerHTML = `📈 ${t('todayStats')}`;
                else if (el.textContent.includes('تتبع') || el.textContent.includes('Room Tracking')) el.innerHTML = `🚪 ${t('roomTracking')}`;
                else if (el.textContent.includes('طلبات') || el.textContent.includes('Guest Requests')) el.innerHTML = `🛎️ ${t('guestRequests')}`;
                else if (el.textContent.includes('الصيانة') || el.textContent.includes('Maintenance')) el.innerHTML = `🛠️ ${t('maintenanceSection')}`;
                else if (el.textContent.includes('السجل') || el.textContent.includes('Log')) el.innerHTML = `🧹 ${t('logCompleted')}`;
            });
            
            // تحديث الإحصائيات
            document.querySelectorAll('.stat-label').forEach((el, i) => {
                const labels = [t('checkout'), t('stayover'), t('requests'), t('maintenance'), t('lastRequest'), t('lastMaintenance')];
                if (labels[i]) el.textContent = labels[i];
            });
            
            // تحديث نشط/متأخر
            document.querySelectorAll('.active-label').forEach((el, i) => {
                el.textContent = i === 0 ? t('active') : t('late');
            });
            
            // تحديث placeholder للبحث
            const searchBar = document.getElementById('search-bar');
            if (searchBar) searchBar.placeholder = `🔍 ${t('searchPlaceholder')}`;
            
            // تحديث مودال الإضافة
            document.getElementById('modal-title-add').textContent = t('addNewRoom');
            document.getElementById('tab-cleaning').innerHTML = `🧹 ${t('cleaning')}`;
            document.getElementById('tab-request').innerHTML = `🛎️ ${t('requestsTab')}`;
            document.getElementById('tab-maintenance').innerHTML = `🛠️ ${t('maintenanceTab')}`;
            
            // تحديث أزرار مودال الإضافة
            const optOut = document.getElementById('opt_out');
            const optStay = document.getElementById('opt_stay');
            if (optOut) optOut.innerHTML = `🚨 ${t('checkoutUrgent')}`;
            if (optStay) optStay.innerHTML = `📅 ${t('stayoverScheduled')}`;
            
            const gstIn = document.getElementById('gst_clean_in');
            const gstOut = document.getElementById('gst_clean_out');
            if (gstIn) gstIn.innerHTML = `👤 ${t('inside')}`;
            if (gstOut) gstOut.innerHTML = `🚶 ${t('outside')}`;
            
            // تحديث أزرار الطلبات والصيانة
            const btnReqImm = document.getElementById('btn-req-imm');
            const btnReqSch = document.getElementById('btn-req-sch');
            if (btnReqImm) btnReqImm.innerHTML = `🚨 ${t('immediate')}`;
            if (btnReqSch) btnReqSch.innerHTML = `📅 ${t('scheduled')}`;
            
            const btnMaintImm = document.getElementById('btn-maint-imm');
            const btnMaintSch = document.getElementById('btn-maint-sch');
            if (btnMaintImm) btnMaintImm.innerHTML = `🚨 ${t('urgent')}`;
            if (btnMaintSch) btnMaintSch.innerHTML = `📅 ${t('scheduled')}`;
            
            // تحديث أزرار الإنهاء
            const stReady = document.getElementById('st_ready');
            const stMaint = document.getElementById('st_maint');
            if (stReady) stReady.innerHTML = `${t('ready')} ✅`;
            if (stMaint) stMaint.innerHTML = `${t('needsMaintenance')} 🛠️`;
            
            // تحديث جميع الكروت
            smartUpdate();
        }
        
        // تحديث الساعة الرقمية المميزة
        function updateDigitalClock(timeValue, inputId) {
            if (!timeValue) return;
            const [hours, minutes] = timeValue.split(':');
            const hour = parseInt(hours);
            const minute = parseInt(minutes);
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
            const timeStr = `${displayHour.toString().padStart(2, '0')}:${minutes}`;
            
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = new Date().getDay();
            const dayName = days[today];
            
            const suffix = inputId === 'systemTimeInput' ? '' : 
                          inputId === 'systemTimeInputReq' ? '-req' : '-maint';
            
            const dayEl = document.getElementById(`clock-day${suffix}`);
            const timeEl = document.getElementById(`clock-time${suffix}`);
            const periodEl = document.getElementById(`clock-period${suffix}`);
            
            if (dayEl) dayEl.textContent = dayName;
            if (timeEl) timeEl.textContent = timeStr;
            if (periodEl) periodEl.textContent = period;
        }
        
        // تهيئة الساعات الرقمية عند فتح المودال
        function initDigitalClocks() {
            const timeInputs = ['systemTimeInput', 'systemTimeInputReq', 'systemTimeInputMaint'];
            timeInputs.forEach(id => {
                const input = document.getElementById(id);
                if (input && input.value) {
                    updateDigitalClock(input.value, id);
                }
            });
        }
        
        // التحكم في الوضع الداكن
        function toggleDarkMode() { 
            const isNowDark = !document.body.classList.contains('dark-mode');
            document.body.classList.toggle('dark-mode'); 
            showMiniAlert(isNowDark ? '🌙 Dark mode enabled' : '☀️ Dark mode disabled', 'success');
        }
        
        // التحكم في وضع التيربو (محذوف - تم دمجه مع الطوارئ)
        
        function closeModal() { 
            document.querySelectorAll('.modal-overlay').forEach(modal => modal.style.display = 'none'); 
        }
        
        function closeAllModals() { 
            closeModal();
        }
        
        function closeCustomAlert() { 
            document.getElementById('customAlertModal').style.display = 'none'; 
        }
        
        // تصدير الدوال للاستخدام العام
        window.adoraSystem = {
            toggleTurboMode,
            toggleDarkMode,
            toggleFocusMode,
            generateDailyReport,
            showQuickReport,
            showPurchasesModal,
            showComprehensiveLog,
            addPoints,
            getState: () => ({ ...appState })
        };
        
        console.log('✅ Adora System is ready!');